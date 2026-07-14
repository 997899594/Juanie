# syntax=docker/dockerfile:1.7
FROM {{BUILD_IMAGE}} AS build
WORKDIR /workspace
COPY . .
{{INSTALL}}
RUN {{BUILD_COMMAND}}

FROM alpine:3.22 AS artifact
COPY --from=build /workspace/{{OUTPUT_PATH}} /juanie/output
