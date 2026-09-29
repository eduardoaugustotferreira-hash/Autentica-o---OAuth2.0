import {
    randomValue,
    sha256
} from "../../_shared/crypto.js";

import {
    getCookie,
    clearTransactionCookie,
    sessionCookie
} from "../../_shared/cookies.js";

import {
    getProvider
} from "../../_shared/providers.js";

import {
    validateGoogleIdToken
} from "../../_shared/oidc.js";


function errorResponse(message, status = 400) {

    return new Response(
        message,
        {
            status,
            headers: {
                "Cache-Control": "no-store"
            }
        }
    );
}


export async function onRequestGet(context) {

    const providerName =
        context.params.provider;

    const provider =
        getProvider(
            providerName,
            context.env
        );


    if (!provider) {
        return errorResponse(
            "Not Found",
            404
        );
    }


    const url =
        new URL(context.request.url);


    if (url.searchParams.has("error")) {
        return errorResponse(
            "Autenticação cancelada ou recusada."
        );
    }


    const code =
        url.searchParams.get("code");

    const state =
        url.searchParams.get("state");


    if (!code || !state) {
        return errorResponse(
            "Resposta OAuth inválida."
        );
    }


    const transactionId =
        getCookie(
            context.request,
            "__Host-oauth-tx"
        );


    if (!transactionId) {
        return errorResponse(
            "Transação OAuth ausente."
        );
    }


    const transactionHash =
        await sha256(transactionId);


    const now =
        Math.floor(Date.now() / 1000);


    const transaction =
        await context.env.DB
            .prepare(`
                SELECT
                    provider,
                    state_hash,
                    nonce,
                    code_verifier,
                    expires_at
                FROM oauth_transactions
                WHERE id_hash = ?
                  AND provider = ?
                  AND expires_at > ?
            `)
            .bind(
                transactionHash,
                providerName,
                now
            )
            .first();


    if (!transaction) {
        return errorResponse(
            "Transação inválida ou expirada."
        );
    }


    const receivedStateHash =
        await sha256(state);


    if (
        receivedStateHash !==
        transaction.state_hash
    ) {

        return errorResponse(
            "State inválido."
        );
    }


    // Apaga a transação antes de continuar.
    await context.env.DB
        .prepare(`
            DELETE FROM oauth_transactions
            WHERE id_hash = ?
        `)
        .bind(transactionHash)
        .run();


    const tokenBody =
        new URLSearchParams();


    tokenBody.set(
        "client_id",
        provider.clientId
    );

    tokenBody.set(
        "client_secret",
        provider.clientSecret
    );

    tokenBody.set(
        "code",
        code
    );

    tokenBody.set(
        "redirect_uri",
        provider.redirectUri
    );

    tokenBody.set(
        "code_verifier",
        transaction.code_verifier
    );


    if (providerName === "google") {

        tokenBody.set(
            "grant_type",
            "authorization_code"
        );

    }


    const tokenResponse =
        await fetch(
            provider.tokenUrl,
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/x-www-form-urlencoded",

                    "Accept":
                        "application/json"
                },

                body:
                    tokenBody.toString()
            }
        );


    if (!tokenResponse.ok) {

    let errorData = null;

    try {
        errorData = await tokenResponse.json();
    } catch {
        // sem corpo JSON
    }

    return errorResponse(
        `Erro OAuth: ${errorData?.error ?? tokenResponse.status} - ${errorData?.error_description ?? "sem descrição"}`
    );
}


    const tokenData =
        await tokenResponse.json();


    let identity;


    if (providerName === "google") {

        if (!tokenData.id_token) {
            return errorResponse(
                "Google não retornou id_token."
            );
        }


        identity =
            await validateGoogleIdToken(
                tokenData.id_token,
                provider.clientId,
                transaction.nonce
            );

    }


    if (providerName === "github") {

        if (
            !tokenData.access_token ||
            String(
                tokenData.token_type
            ).toLowerCase() !== "bearer"
        ) {

            return errorResponse(
                "Token do GitHub inválido."
            );
        }


        const accessToken =
            tokenData.access_token;


        const userResponse =
            await fetch(
                "https://api.github.com/user",
                {
                    headers: {

                        "Authorization":
                            `Bearer ${accessToken}`,

                        "Accept":
                            "application/vnd.github+json",

                        "X-GitHub-Api-Version":
                            "2026-03-10",

                        "User-Agent":
                            "oauth-pages-lab"
                    }
                }
            );


        if (!userResponse.ok) {
            return errorResponse(
                "Falha ao consultar usuário do GitHub."
            );
        }


        const user =
            await userResponse.json();


        if (
            !Number.isInteger(user.id)
        ) {

            return errorResponse(
                "Identidade do GitHub inválida."
            );
        }


        const credentials =
            btoa(
                `${provider.clientId}:${provider.clientSecret}`
            );


        const revokeResponse =
            await fetch(
                `https://api.github.com/applications/${provider.clientId}/grant`,
                {
                    method: "DELETE",

                    headers: {

                        "Authorization":
                            `Basic ${credentials}`,

                        "Accept":
                            "application/vnd.github+json",

                        "X-GitHub-Api-Version":
                            "2026-03-10",

                        "Content-Type":
                            "application/json",

                        "User-Agent":
                            "oauth-pages-lab"
                    },

                    body:
                        JSON.stringify({
                            access_token:
                                accessToken
                        })
                }
            );


        if (
            revokeResponse.status !== 204
        ) {

            return errorResponse(
                "Não foi possível revogar o token do GitHub."
            );
        }


        identity = {

            issuer:
                "https://github.com",

            subject:
                String(user.id),

            email:
                user.email ?? null,

            displayName:
                user.name ??
                user.login ??
                null
        };

    }


    if (!identity) {
        return errorResponse(
            "Identidade inválida."
        );
    }


    const sessionId =
        randomValue();


    const sessionHash =
        await sha256(sessionId);


    const createdAt =
        Math.floor(Date.now() / 1000);


    const expiresAt =
        createdAt + 28800;


    await context.env.DB
        .prepare(`
            INSERT INTO sessions
            (
                id_hash,
                issuer,
                subject,
                email,
                display_name,
                expires_at,
                created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `)
        .bind(
            sessionHash,
            identity.issuer,
            identity.subject,
            identity.email,
            identity.displayName,
            expiresAt,
            createdAt
        )
        .run();


    const headers =
        new Headers();


    headers.set(
        "Location",
        context.env.PUBLIC_BASE_URL
    );


    headers.append(
        "Set-Cookie",
        clearTransactionCookie()
    );


    headers.append(
        "Set-Cookie",
        sessionCookie(sessionId)
    );


    headers.set(
        "Cache-Control",
        "no-store"
    );


    return new Response(
        null,
        {
            status: 302,
            headers
        }
    );
}