package io.yamsergey.adt.workspace.kotlin.model;

import java.util.Map;

import lombok.Builder;

/**
 * Java module settings for the workspace.
 *
 * Represents Java-specific compiler settings for a module.
 */
@Builder(toBuilder = true)
public record JavaSettings(
        String module,
        boolean inheritedCompilerOutput,
        boolean excludeOutput,
        String compilerOutput,
        String compilerOutputForTests,
        String languageLevelId,
        Map<String, String> manifestAttributes) {
}
