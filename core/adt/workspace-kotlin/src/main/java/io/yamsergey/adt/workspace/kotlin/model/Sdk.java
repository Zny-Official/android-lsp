package io.yamsergey.adt.workspace.kotlin.model;

import java.util.Collection;

import lombok.Builder;
import lombok.Singular;

/**
 * SDK definition for the workspace.
 *
 * Represents SDK configuration, typically for Java/Kotlin SDKs.
 * Often empty in workspace configurations.
 */
@Builder(toBuilder = true)
public record Sdk(
        String name,
        String type,
        String version,
        String homePath,
        @Singular Collection<SdkRoot> roots,
        String additionalData) {

    @Builder(toBuilder = true)
    public record SdkRoot(
            String url,
            String type) {
    }
}