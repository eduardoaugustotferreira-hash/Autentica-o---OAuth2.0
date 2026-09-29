import {
    getCookie,
    clearSessionCookie
} from "../_shared/cookies.js";

import {
    sha256
} from "../_shared/crypto.js";


export async function onRequestPost(context) {

    const origin =
        context.request.headers.get("Origin");


    if (
        origin !== context.env.PUBLIC_BASE_URL
    ) {

        return new Response(
            "Origin inválido.",
            {
                status: 403,
                headers: {
                    "Cache-Control": "no-store"
                }
            }
        );
    }


    const sessionId =
        getCookie(
            context.request,
            "__Host-session"
        );


    if (sessionId) {

        const sessionHash =
            await sha256(sessionId);


        await context.env.DB
            .prepare(`
                DELETE FROM sessions
                WHERE id_hash = ?
            `)
            .bind(sessionHash)
            .run();

    }


    return new Response(
        null,
        {
            status: 302,

            headers: {
                "Location":
                    context.env.PUBLIC_BASE_URL,

                "Set-Cookie":
                    clearSessionCookie(),

                "Cache-Control":
                    "no-store"
            }
        }
    );
}