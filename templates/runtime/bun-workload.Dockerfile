# syntax=docker/dockerfile:1.7
FROM {{BUILD_IMAGE}} AS build
WORKDIR /workspace
COPY . .
{{INSTALL}}
RUN {{BUILD_COMMAND}}

FROM {{BUILD_IMAGE}} AS runtime
WORKDIR /workspace
ENV NODE_ENV=production
COPY --from=build /workspace /workspace
WORKDIR /workspace/{{APP_DIR}}
EXPOSE {{PORT}}
CMD ["sh", "-c", {{START_COMMAND_JSON}}]
