/*
 * Copyright (c) 2026 Zny-Official
 *
 * Licensed under the GNU Lesser General Public License v3.0
 * See LICENSE.txt for details.
 *
 * Inspired by: https://github.com/Kotlin/kotlin-lsp/issues/97#issuecomment-3957021983
 * Original approach: bash script for patching workspace.json with Compose compiler plugin
 */
package io.yamsergey.adt.workspace.kotlin.service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Optional;

public class ComposePluginResolver {

    private final Path gradleCachesPath;

    public ComposePluginResolver() {
        String gradleHome = System.getenv("GRADLE_USER_HOME");
        if (gradleHome == null) {
            gradleHome = System.getProperty("user.home") + "/.gradle";
        }
        this.gradleCachesPath = Path.of(gradleHome, "caches");
    }

    public ComposePluginResolver(Path gradleCachesPath) {
        this.gradleCachesPath = gradleCachesPath;
    }

    public Optional<Path> resolveComposeCompilerPlugin() {
        if (!Files.isDirectory(gradleCachesPath)) {
            return Optional.empty();
        }

        try {
            return Files.walk(gradleCachesPath)
                .filter(Files::isRegularFile)
                .filter(p -> {
                    String fileName = p.getFileName().toString();
                    return fileName.startsWith("kotlin-compose-compiler-plugin-embeddable")
                        && fileName.endsWith(".jar");
                })
                .findFirst();
        } catch (IOException e) {
            return Optional.empty();
        }
    }

    public String buildCompilerArguments(String jvmTarget, Path pluginJar) {
        String escapedPath = pluginJar.toString()
            .replace("\\", "\\\\")
            .replace("\"", "\\\"");

        return String.format(
            "J{\"jvmTarget\":\"%s\",\"pluginOptions\":[],\"pluginClasspaths\":[\"%s\"]}",
            jvmTarget, escapedPath
        );
    }

    public Path getGradleCachesPath() {
        return gradleCachesPath;
    }
}
