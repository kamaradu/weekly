
// /worker.js

export default {
  async fetch(request, env) {
    const authorization = request.headers.get("Authorization");

    if (!authorization || !authorization.startsWith("Basic ")) {
      return unauthorized();
    }

    const credentials = decodeBasicAuth(authorization);

    if (!credentials) {
      return unauthorized();
    }

    const { username, password } = credentials;

    if (
      username !== env.AUTH_USERNAME ||
      password !== env.AUTH_PASSWORD
    ) {
      return unauthorized();
    }

    return env.ASSETS.fetch(request);
  },
};

function unauthorized() {
  return new Response("Authentication required.", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Private Statistics"',
      "Cache-Control": "no-store",
    },
  });
}

function decodeBasicAuth(authorization) {
  try {
    const encoded = authorization.slice("Basic ".length).trim();
    const decoded = atob(encoded);
    const separator = decoded.indexOf(":");

    if (separator === -1) {
      return null;
    }

    return {
      username: decoded.slice(0, separator),
      password: decoded.slice(separator + 1),
    };
  } catch {
    return null;
  }
}
