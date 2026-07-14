# syntax=docker/dockerfile:1.7
FROM {{BUILD_IMAGE}} AS build
WORKDIR /workspace
COPY . .
{{INSTALL}}
RUN {{BUILD_COMMAND}}

FROM nginx:1.29-alpine AS runtime
COPY .juanie/runtime/static-nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /workspace/{{OUTPUT_PATH}} /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
CMD ["nginx", "-g", "daemon off;"]
