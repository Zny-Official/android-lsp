/*
 * Original work Copyright (c) yamsergey
 * Modified work Copyright (c) 2026 Zny-Official
 *
 * Licensed under the GNU Lesser General Public License v3.0
 * This file has been modified to support Compose compiler plugin.
 * See LICENSE.txt for details.
 */
package io.yamsergey.adt.workspace.kotlin.model;

import java.util.Collection;

import lombok.Builder;
import lombok.Singular;

@Builder(toBuilder = true)
public record KotlinSettings(
    String name,
    @Singular Collection<String> sourceRoots,
    @Singular Collection<String> configFileItems,
    String module,
    boolean useProjectSettings,
    @Singular Collection<String> implementedModuleNames,
    @Singular Collection<String> dependsOnModuleNames,
    @Singular Collection<String> additionalVisibleModuleNames,
    String productionOutputPath,
    String testOutputPath,
    @Singular Collection<String> sourceSetNames,
    boolean isTestModule,
    String externalProjectId,
    boolean isHmppEnabled,
    @Singular Collection<String> pureKotlinSourceFolders,
    String kind,
    String compilerArguments,
    String additionalArguments,
    String scriptTemplates,
    String scriptTemplatesClasspath,
    String outputDirectoryForJsLibraryFiles,
    String targetPlatform,
    @Singular Collection<String> externalSystemRunTasks,
    int version,
    boolean flushNeeded
) {}
