FROM node:22-alpine AS build
WORKDIR /app

RUN corepack enable pnpm

# Install deps first so the layer caches independently of source changes.
# pnpm-workspace.yaml is required here, not just for tidiness: it carries the
# allowBuilds setting that lets esbuild run its postinstall. Without it the
# esbuild binary is never fetched and `pnpm build` fails inside the image.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

FROM nginx:1.27-alpine AS dist

COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
