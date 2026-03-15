/*
 * Copyright (c) 2026 Zny-Official
 *
 * Licensed under the GNU Lesser General Public License v3.0
 * See LICENSE.txt for details.
 *
 * Inspired by: https://github.com/Kotlin/kotlin-lsp/issues/97#issuecomment-3957021983
 * Original approach: bash script for attaching source JARs from Gradle cache
 */
package io.yamsergey.adt.workspace.kotlin.service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Optional;

public class SourceJarResolver {

    private final Path gradleCachesPath;

    public SourceJarResolver() {
        String gradleHome = System.getenv("GRADLE_USER_HOME");
        if (gradleHome == null) {
            gradleHome = System.getProperty("user.home") + "/.gradle";
        }
        this.gradleCachesPath = Path.of(gradleHome, "caches");
    }

    public SourceJarResolver(Path gradleCachesPath) {
        this.gradleCachesPath = gradleCachesPath;
    }

    public Optional<Path> resolveSourceJar(String groupId, String artifactId, String version) {
        if (groupId == null || artifactId == null || version == null) {
            return Optional.empty();
        }

        Path baseDir = gradleCachesPath
            .resolve("modules-2")
            .resolve("files-2.1")
            .resolve(groupId)
            .resolve(artifactId)
            .resolve(version);

        if (!Files.isDirectory(baseDir)) {
            return Optional.empty();
        }

        try {
            return Files.walk(baseDir)
                .filter(Files::isRegularFile)
                .filter(p -> p.getFileName().toString().endsWith("-sources.jar"))
                .filter(p -> !p.getFileName().toString().toLowerCase().contains("samples"))
                .min((a, b) -> {
                    String preferredName = artifactId + "-" + version + "-sources.jar";
                    boolean aPreferred = a.getFileName().toString().equals(preferredName);
                    boolean bPreferred = b.getFileName().toString().equals(preferredName);
                    return Boolean.compare(bPreferred, aPreferred);
                });
        } catch (IOException e) {
            return Optional.empty();
        }
    }

    public Path getGradleCachesPath() {
        return gradleCachesPath;
    }
}
