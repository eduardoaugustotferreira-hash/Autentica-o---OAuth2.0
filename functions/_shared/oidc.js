function base64UrlDecode(value) {
    const base64 = value
        .replace(/-/g, "+")
        .replace(/_/g, "/");

    const padded =
        base64 + "=".repeat((4 - (base64.length % 4)) % 4);

    const binary = atob(padded);

    return Uint8Array.from(
        binary,
        (char) => char.charCodeAt(0)
    );
}


function decodeJsonPart(value) {
    const bytes = base64UrlDecode(value);
    const text = new TextDecoder().decode(bytes);

    return JSON.parse(text);
}


export async function validateGoogleIdToken(
    idToken,
    expectedClientId,
    expectedNonce
) {
    const parts = idToken.split(".");

    if (parts.length !== 3) {
        throw new Error("Token Google inválido.");
    }

    const [headerPart, payloadPart, signaturePart] = parts;

    const header = decodeJsonPart(headerPart);
    const payload = decodeJsonPart(payloadPart);

    if (header.alg !== "RS256") {
        throw new Error("Algoritmo inválido.");
    }

    if (!header.kid) {
        throw new Error("kid ausente.");
    }

    const discoveryResponse = await fetch(
        "https://accounts.google.com/.well-known/openid-configuration"
    );

    if (!discoveryResponse.ok) {
        throw new Error("Falha ao obter configuração OIDC.");
    }

    const discovery = await discoveryResponse.json();

    const jwksResponse = await fetch(discovery.jwks_uri);

    if (!jwksResponse.ok) {
        throw new Error("Falha ao obter chaves do Google.");
    }

    const jwks = await jwksResponse.json();

    const jwk = jwks.keys.find(
        (key) => key.kid === header.kid
    );

    if (!jwk) {
        throw new Error("Chave pública não encontrada.");
    }

    const publicKey = await crypto.subtle.importKey(
        "jwk",
        jwk,
        {
            name: "RSASSA-PKCS1-v1_5",
            hash: "SHA-256"
        },
        false,
        ["verify"]
    );

    const signedData =
        new TextEncoder().encode(
            `${headerPart}.${payloadPart}`
        );

    const signature =
        base64UrlDecode(signaturePart);

    const validSignature =
        await crypto.subtle.verify(
            "RSASSA-PKCS1-v1_5",
            publicKey,
            signature,
            signedData
        );

    if (!validSignature) {
        throw new Error("Assinatura inválida.");
    }

    const now = Math.floor(Date.now() / 1000);

    const validIssuer =
        payload.iss === "https://accounts.google.com" ||
        payload.iss === "accounts.google.com";

    if (!validIssuer) {
        throw new Error("Issuer inválido.");
    }

    if (payload.aud !== expectedClientId) {
        throw new Error("Audience inválido.");
    }

    if (
        typeof payload.exp !== "number" ||
        payload.exp <= now
    ) {
        throw new Error("Token expirado.");
    }

    if (
        typeof payload.iat !== "number" ||
        payload.iat > now + 60
    ) {
        throw new Error("iat inválido.");
    }

    if (payload.nonce !== expectedNonce) {
        throw new Error("Nonce inválido.");
    }

    if (!payload.sub) {
        throw new Error("sub ausente.");
    }

    return {
        issuer: payload.iss,
        subject: payload.sub,
        email: payload.email ?? null,
        displayName: payload.name ?? payload.email ?? null
    };
}