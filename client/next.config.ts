import type { NextConfig } from "next";
const nextConfig: NextConfig = {
    cacheComponents: true,
    partialPrefetching: true,
    turbopack: {
        rules: {
            "*.css": {
                loaders: ["@tailwindcss/turbopack"],
                as: "*.css",
            },
        },
    },
    async rewrites() {
        return [
            {
                source: "/api/:path*",
                destination: "http://localhost:5000/api/:path*",
            },
            {
                source: "/uploads/:path*",
                destination: "http://localhost:5000/uploads/:path*",
            },
            {
                source: "/socket.io/:path*",
                destination: "http://localhost:5000/socket.io/:path*",
            },
        ];
    },
};
export default nextConfig;
