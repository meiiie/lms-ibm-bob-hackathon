# syntax=docker/dockerfile:1
# Build from repository root. This image intentionally excludes media conversion.
FROM maven:3.9.14-eclipse-temurin-21 AS build
WORKDIR /build
ENV MAVEN_OPTS="-Xmx512m"
COPY backend/pom.xml ./pom.xml
RUN --mount=type=cache,target=/root/.m2/repository mvn dependency:go-offline -B -ntp
COPY backend/src ./src
RUN --mount=type=cache,target=/root/.m2/repository mvn package -DskipTests -B -ntp

FROM eclipse-temurin:21-jre-alpine
RUN addgroup -S lms && adduser -S -G lms -u 1001 lms
WORKDIR /app
RUN mkdir uploads logs && chown -R lms:lms /app
COPY --from=build --chown=lms:lms /build/target/backend-lms-postgres-*.jar /app/app.jar
USER 1001
ENV SPRING_PROFILES_ACTIVE="prod,demo" \
    JAVA_TOOL_OPTIONS="-XX:+UseContainerSupport -XX:MaxRAMPercentage=60.0 -XX:+UseSerialGC -XX:+ExitOnOutOfMemoryError" \
    PORT="8080"
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=10s --start-period=180s --retries=5 \
    CMD wget -q --spider --tries=1 --timeout=8 "http://127.0.0.1:${PORT}/actuator/health" || exit 1
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
