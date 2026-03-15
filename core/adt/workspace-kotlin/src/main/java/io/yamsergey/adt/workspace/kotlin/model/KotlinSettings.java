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
