export function getCookie(request, name) {

    const cookieHeader =
        request.headers.get("Cookie");

    if (!cookieHeader) {
        return null;
    }

    const cookies =
        cookieHeader.split(";");

    for (const cookie of cookies) {

        const [key, ...valueParts] =
            cookie.trim().split("=");

        if (key === name) {

            return valueParts.join("=");

        }

    }

    return null;
}


export function transactionCookie(value) {

    return `__Host-oauth-tx=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`;
}


export function clearTransactionCookie() {

    return "__Host-oauth-tx=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0";
}


export function sessionCookie(value) {

    return `__Host-session=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=28800`;
}


export function clearSessionCookie() {

    return "__Host-session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0";
}