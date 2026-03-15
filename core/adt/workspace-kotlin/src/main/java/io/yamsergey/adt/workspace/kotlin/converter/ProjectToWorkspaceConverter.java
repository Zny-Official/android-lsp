/*
 * Original work Copyright (c) yamsergey
 * Modified work Copyright (c) 2026 Zny-Official
 *
 * Licensed under the GNU Lesser General Public License v3.0
 * This file has been modified to support Compose compiler plugin.
 * See LICENSE.txt for details.
 */
package io.yamsergey.adt.workspace.kotlin.converter;

import java.util.ArrayList;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

import javax.annotation.Nonnull;

import io.yamsergey.adt.tools.android.model.dependency.AndroidProjectDependency;
import io.yamsergey.adt.tools.android.model.dependency.ClassFolderDependency;
import io.yamsergey.adt.tools.android.model.dependency.GenericProjectDependency;
import io.yamsergey.adt.tools.android.model.dependency.GradleAarDependency;
import io.yamsergey.adt.tools.android.model.dependency.GradleJarDependency;
import io.yamsergey.adt.tools.android.model.dependency.LocalJarDependency;
import io.yamsergey.adt.tools.android.model.dependency.ProjectDependency;
import io.yamsergey.adt.tools.android.model.module.ResolvedAndroidModule;
import io.yamsergey.adt.tools.android.model.module.ResolvedGenericModule;
import io.yamsergey.adt.tools.android.model.module.ResolvedModule;
import io.yamsergey.adt.tools.android.model.project.Project;
import io.yamsergey.adt.workspace.kotlin.model.ContentRoot;
import io.yamsergey.adt.workspace.kotlin.model.Dependency;
import io.yamsergey.adt.workspace.kotlin.model.KotlinSettings;
import io.yamsergey.adt.workspace.kotlin.model.Library;
import io.yamsergey.adt.workspace.kotlin.model.Module;
import io.yamsergey.adt.workspace.kotlin.model.Sdk;
import io.yamsergey.adt.workspace.kotlin.model.SourceRoot;
import io.yamsergey.adt.workspace.kotlin.model.Workspace;
import io.yamsergey.adt.workspace.kotlin.service.ComposePluginResolver;
import io.yamsergey.adt.workspace.kotlin.service.SourceJarResolver;

public class ProjectToWorkspaceConverter {

    private final ComposePluginResolver composeResolver;
    private final SourceJarResolver sourceResolver;
    private final ConverterConfig config;

    public ProjectToWorkspaceConverter() {
        this(ConverterConfig.defaults());
    }

    public ProjectToWorkspaceConverter(ConverterConfig config) {
        this.config = config != null ? config : ConverterConfig.defaults();
        this.composeResolver = new ComposePluginResolver();
        this.sourceResolver = new SourceJarResolver();
    }

    public Workspace convert(@Nonnull Project project) {
        Collection<Module> modules = convertModules(project.modules());
        Collection<Library> libraries = extractLibraries(project.modules());
        Collection<Sdk> sdks = List.of();
        Collection<KotlinSettings> kotlinSettings = generateKotlinSettings(project.modules());

        return Workspace.builder()
            .modules(modules)
            .libraries(libraries)
            .sdks(sdks)
            .kotlinSettings(kotlinSettings)
            .build();
    }

    private Collection<Module> convertModules(Collection<ResolvedModule> projectModules) {
        return projectModules.stream()
            .flatMap(module -> convertSingleModule(module).stream())
            .collect(Collectors.toList());
    }

    private Collection<Module> convertSingleModule(ResolvedModule projectModule) {
        List<Module> result = new ArrayList<>();

        switch (projectModule) {
            case ResolvedAndroidModule androidModule -> {
                result.add(createMainModule(androidModule));
                if (hasTestSources(androidModule)) {
                    result.add(createTestModule(androidModule));
                }
            }
            case ResolvedGenericModule genericModule -> {
                result.add(createMainModule(genericModule));
                if (hasTestSources(genericModule)) {
                    result.add(createTestModule(genericModule));
                }
            }
            default -> {
            }
        }

        return result;
    }

    private Module createMainModule(ResolvedAndroidModule projectModule) {
        String moduleName = projectModule.name();
        Collection<Dependency> dependencies = convertDependencies(projectModule, false);
        Collection<ContentRoot> contentRoots = convertContentRoots(projectModule, false);

        return Module.builder()
            .name(moduleName)
            .dependencies(dependencies)
            .contentRoots(contentRoots)
            .facets(List.of())
            .build();
    }

    private Module createMainModule(ResolvedGenericModule projectModule) {
        String moduleName = projectModule.name() + ".main";
        Collection<Dependency> dependencies = convertDependencies(projectModule, false);
        Collection<ContentRoot> contentRoots = convertContentRoots(projectModule, false);

        return Module.builder()
            .name(moduleName)
            .dependencies(dependencies)
            .contentRoots(contentRoots)
            .facets(List.of())
            .build();
    }

    private Module createTestModule(ResolvedAndroidModule projectModule) {
        String moduleName = projectModule.name() + ".test";
        Collection<Dependency> dependencies = convertDependencies(projectModule, true);
        Collection<ContentRoot> contentRoots = convertContentRoots(projectModule, true);

        Collection<Dependency> allDependencies = new ArrayList<>(dependencies);
        allDependencies.add(Dependency.builder()
            .type(Dependency.DependencyType.module)
            .name(projectModule.name() + ".main")
            .scope(Dependency.DependencyScope.compile)
            .build());

        return Module.builder()
            .name(moduleName)
            .dependencies(allDependencies)
            .contentRoots(contentRoots)
            .facets(List.of())
            .build();
    }

    private Module createTestModule(ResolvedGenericModule projectModule) {
        String moduleName = projectModule.name() + ".test";
        Collection<Dependency> dependencies = convertDependencies(projectModule, true);
        Collection<ContentRoot> contentRoots = convertContentRoots(projectModule, true);

        Collection<Dependency> allDependencies = new ArrayList<>(dependencies);
        allDependencies.add(Dependency.builder()
            .type(Dependency.DependencyType.module)
            .name(projectModule.name() + ".main")
            .scope(Dependency.DependencyScope.compile)
            .build());

        return Module.builder()
            .name(moduleName)
            .dependencies(allDependencies)
            .contentRoots(contentRoots)
            .facets(List.of())
            .build();
    }

    private Collection<Dependency> convertDependencies(ResolvedAndroidModule projectModule, boolean testScope) {
        return projectModule.dependencies().stream()
            .filter(dep -> testScope ? isTestDependency(dep) : !isTestDependency(dep))
            .map(dependency -> convertDependency(dependency, projectModule.name()))
            .collect(Collectors.toList());
    }

    private Collection<Dependency> convertDependencies(ResolvedGenericModule projectModule, boolean testScope) {
        return projectModule.dependencies().stream()
            .filter(dep -> testScope ? isTestDependency(dep) : !isTestDependency(dep))
            .map(dependnecy -> convertDependency(dependnecy, projectModule.name()))
            .collect(Collectors.toList());
    }

    private Dependency convertDependency(io.yamsergey.adt.tools.android.model.dependency.Dependency projectDep,
        String moduleName) {
        return switch (projectDep) {
            case GradleJarDependency jar -> Dependency.builder()
                .type(Dependency.DependencyType.library)
                .name("Gradle: " + jar.groupId() + ":" + jar.artifactId() + ":" + jar.version())
                .scope(convertScope(jar.scope()))
                .build();
            case GradleAarDependency aar -> Dependency.builder()
                .type(Dependency.DependencyType.library)
                .name("Gradle: " + aar.groupId() + ":" + aar.artifactId() + ":" + aar.version())
                .scope(convertScope(aar.scope()))
                .build();
            case AndroidProjectDependency androidProject -> Dependency.builder()
                .type(Dependency.DependencyType.module)
                .name(androidProject.projectPath().substring(1))
                .scope(convertScope(androidProject.scope()))
                .build();
            case GenericProjectDependency genericProject -> Dependency.builder()
                .type(Dependency.DependencyType.module)
                .name(genericProject.projectPath().substring(1) + ".main")
                .scope(convertScope(genericProject.scope()))
                .build();
            case LocalJarDependency localJar -> {
                String depName;
                if (localJar.path().contains("android.jar")) {
                    String version = extractAndroidApiVersion(localJar.path());
                    depName = String.format("Gradle: %s %s", moduleName, "android:android:" + version);
                } else {
                    depName = String.format("Gradle: %s %s", moduleName, extractLibraryName(localJar.path()));
                }
                yield Dependency.builder()
                    .type(Dependency.DependencyType.library)
                    .name(depName)
                    .scope(convertScope(localJar.scope()))
                    .build();
            }
            case ClassFolderDependency classFolder -> Dependency.builder()
                .type(Dependency.DependencyType.library)
                .name("Gradle: " + extractLibraryName(classFolder.path()))
                .scope(convertScope(classFolder.scope()))
                .build();
        };
    }

    private Collection<ContentRoot> convertContentRoots(ResolvedAndroidModule projectModule, boolean testScope) {
        Collection<SourceRoot> sourceRoots = projectModule.roots().stream()
            .filter(root -> testScope ? isTestSourceRoot(root) : !isTestSourceRoot(root))
            .map(this::convertSourceRoot)
            .collect(Collectors.toList());

        if (sourceRoots.isEmpty()) {
            return List.of();
        }

        return List.of(ContentRoot.builder()
            .path(projectModule.path())
            .sourceRoots(sourceRoots)
            .build());
    }

    private Collection<ContentRoot> convertContentRoots(ResolvedGenericModule projectModule, boolean testScope) {
        Collection<SourceRoot> sourceRoots = projectModule.roots().stream()
            .filter(root -> testScope ? isTestSourceRoot(root) : !isTestSourceRoot(root))
            .map(this::convertSourceRoot)
            .collect(Collectors.toList());

        if (sourceRoots.isEmpty()) {
            return List.of();
        }

        return List.of(ContentRoot.builder()
            .path(projectModule.path())
            .sourceRoots(sourceRoots)
            .build());
    }

    private SourceRoot convertSourceRoot(io.yamsergey.adt.tools.android.model.SourceRoot projectRoot) {
        boolean isTest = isTestSourceRoot(projectRoot);

        SourceRoot.SourceRootType type = switch (projectRoot.language()) {
            case JAVA -> isTest ? SourceRoot.SourceRootType.testJava : SourceRoot.SourceRootType.java;
            case KOTLIN -> isTest ? SourceRoot.SourceRootType.testKotlin : SourceRoot.SourceRootType.kotlin;
            case OTHER -> isTest ? SourceRoot.SourceRootType.testResources : SourceRoot.SourceRootType.resources;
        };

        return SourceRoot.builder()
            .path(projectRoot.path())
            .type(type)
            .build();
    }

    private Collection<Library> extractLibraries(Collection<ResolvedModule> projectModules) {
        Set<SourceRoot> libraryPaths = new HashSet<>();
        List<Library> libraries = new ArrayList<>();

        for (ResolvedModule module : projectModules) {
            var moduleName = switch (module) {
                case ResolvedAndroidModule androidModule -> androidModule.name();
                case ResolvedGenericModule genericModule -> genericModule.name();
                default -> "";
            };
            Collection<io.yamsergey.adt.tools.android.model.dependency.Dependency> dependencies = switch (module) {
                case ResolvedAndroidModule androidModule -> androidModule.dependencies();
                case ResolvedGenericModule genericModule -> genericModule.dependencies();
                default -> List.of();
            };

            for (var dependency : dependencies) {
                if (dependency instanceof ProjectDependency) {
                    continue;
                }

                String path = dependency.path();
                SourceRoot root = SourceRoot.builder().path(path).build();
                if (!libraryPaths.contains(root)) {
                    libraryPaths.add(root);
                    libraries.add(createLibrary(dependency, moduleName));
                }
            }
        }

        return libraries;
    }

    private Library createLibrary(io.yamsergey.adt.tools.android.model.dependency.Dependency dependency,
        String moduleName) {
        String name;
        Library.LibraryType type = determineLibraryType(dependency);
        List<SourceRoot> roots = new ArrayList<>();
        Library.LibraryAttributes attributes;

        switch (dependency) {
            case GradleJarDependency jar -> {
                name = "Gradle: " + jar.groupId() + ":" + jar.artifactId() + ":" + jar.version();
                roots.add(SourceRoot.builder().path(jar.path()).build());
                attributes = Library.LibraryAttributes.builder()
                    .groupId(jar.groupId())
                    .artifactId(jar.artifactId())
                    .version(jar.version())
                    .baseVersion(jar.version())
                    .build();
            }
            case GradleAarDependency aar -> {
                name = "Gradle: " + aar.groupId() + ":" + aar.artifactId() + ":" + aar.version();
                if (aar.resolvedJars().isEmpty()) {
                    roots.add(SourceRoot.builder().path(aar.path()).build());
                } else {
                    aar.resolvedJars().forEach(entry ->
                        roots.add(SourceRoot.builder().path(entry).build()));
                }
                attributes = Library.LibraryAttributes.builder()
                    .groupId(aar.groupId())
                    .artifactId(aar.artifactId())
                    .version(aar.version())
                    .baseVersion(aar.version())
                    .build();
            }
            case AndroidProjectDependency androidProject -> {
                throw new IllegalStateException("ProjectDependency should not be converted to Library");
            }
            case GenericProjectDependency genericProject -> {
                throw new IllegalStateException("ProjectDependency should not be converted to Library");
            }
            case LocalJarDependency localJar -> {
                if (localJar.path().contains("android.jar")) {
                    String version = extractAndroidApiVersion(localJar.path());
                    name = String.format("Gradle: %s %s", moduleName, "android:android:" + version);
                    attributes = Library.LibraryAttributes.builder()
                        .groupId("android")
                        .artifactId("android")
                        .version(version)
                        .baseVersion(version)
                        .build();
                } else {
                    String libraryName = extractLibraryName(localJar.path());
                    name = String.format("Gradle: %s %s", moduleName, libraryName);
                    attributes = Library.LibraryAttributes.builder()
                        .groupId("local")
                        .artifactId(libraryName)
                        .version("unknown")
                        .baseVersion("unknown")
                        .build();
                }
                roots.add(SourceRoot.builder().path(localJar.path()).build());
            }
            case ClassFolderDependency classFolder -> {
                name = "Gradle: " + extractLibraryName(classFolder.path());
                roots.add(SourceRoot.builder().path(classFolder.path()).build());
                attributes = Library.LibraryAttributes.builder()
                    .groupId("local")
                    .artifactId(extractLibraryName(classFolder.path()))
                    .version("unknown")
                    .baseVersion("unknown")
                    .build();
            }
        }

        if (config.attachSourceJars() && attributes != null) {
            Optional<java.nio.file.Path> sourceJar = sourceResolver.resolveSourceJar(
                attributes.groupId(),
                attributes.artifactId(),
                attributes.version()
            );

            sourceJar.ifPresent(path ->
                roots.add(SourceRoot.builder()
                    .path(path.toString())
                    .type(SourceRoot.SourceRootType.sources)
                    .build())
            );
        }

        return Library.builder()
            .name(name)
            .type(type)
            .roots(roots)
            .properties(Library.Properties.builder().attributes(attributes).build())
            .build();
    }

    private Collection<KotlinSettings> generateKotlinSettings(Collection<ResolvedModule> projectModules) {
        String composeCompilerArgs = null;

        if (config.enableComposeSupport()) {
            Optional<java.nio.file.Path> pluginJar = composeResolver.resolveComposeCompilerPlugin();
            if (pluginJar.isPresent()) {
                composeCompilerArgs = composeResolver.buildCompilerArguments(
                    config.jvmTarget(),
                    pluginJar.get()
                );
            }
        }

        String finalCompilerArgs = composeCompilerArgs;
        return projectModules.stream()
            .filter(this::hasKotlinSources)
            .map(module -> buildKotlinSettings(module, finalCompilerArgs))
            .collect(Collectors.toList());
    }

    private KotlinSettings buildKotlinSettings(ResolvedModule module, String compilerArgs) {
        String moduleName = extractModuleName(module);
        Collection<String> sourceRoots = extractSourceRootPaths(module);

        return KotlinSettings.builder()
            .name("Kotlin")
            .sourceRoots(sourceRoots)
            .module(moduleName)
            .useProjectSettings(false)
            .externalProjectId(moduleName)
            .isHmppEnabled(true)
            .kind("default")
            .compilerArguments(compilerArgs)
            .version(5)
            .flushNeeded(false)
            .build();
    }

    private String extractModuleName(ResolvedModule module) {
        return switch (module) {
            case ResolvedAndroidModule androidModule -> androidModule.name();
            case ResolvedGenericModule genericModule -> genericModule.name();
            default -> "";
        };
    }

    private Collection<String> extractSourceRootPaths(ResolvedModule module) {
        Collection<io.yamsergey.adt.tools.android.model.SourceRoot> roots = switch (module) {
            case ResolvedAndroidModule androidModule -> androidModule.roots();
            case ResolvedGenericModule genericModule -> genericModule.roots();
            default -> List.of();
        };

        return roots.stream()
            .filter(root -> !isTestSourceRoot(root))
            .map(io.yamsergey.adt.tools.android.model.SourceRoot::path)
            .collect(Collectors.toList());
    }

    private boolean hasTestSources(ResolvedModule module) {
        Collection<io.yamsergey.adt.tools.android.model.SourceRoot> roots = switch (module) {
            case ResolvedAndroidModule androidModule -> androidModule.roots();
            case ResolvedGenericModule genericModule -> genericModule.roots();
            default -> List.of();
        };
        return roots.stream().anyMatch(this::isTestSourceRoot);
    }

    private boolean hasKotlinSources(ResolvedModule module) {
        Collection<io.yamsergey.adt.tools.android.model.SourceRoot> roots = switch (module) {
            case ResolvedAndroidModule androidModule -> androidModule.roots();
            case ResolvedGenericModule genericModule -> genericModule.roots();
            default -> List.of();
        };
        return roots.stream()
            .anyMatch(root -> root.language() == io.yamsergey.adt.tools.android.model.SourceRoot.Language.KOTLIN);
    }

    private boolean isTestDependency(io.yamsergey.adt.tools.android.model.dependency.Dependency dependency) {
        return dependency.scope() == io.yamsergey.adt.tools.android.model.dependency.Dependency.Scope.TEST;
    }

    private boolean isTestSourceRoot(io.yamsergey.adt.tools.android.model.SourceRoot root) {
        return root.path().contains("/test/") || root.path().contains("\\test\\");
    }

    private Dependency.DependencyScope convertScope(
        io.yamsergey.adt.tools.android.model.dependency.Dependency.Scope scope) {
        return switch (scope) {
            case COMPILE -> Dependency.DependencyScope.compile;
            case RUNTIME -> Dependency.DependencyScope.runtime;
            case TEST -> Dependency.DependencyScope.test;
        };
    }

    private String extractLibraryName(String path) {
        String fileName = path.substring(path.lastIndexOf('/') + 1);
        return fileName.endsWith(".jar") || fileName.endsWith(".aar")
            ? fileName.substring(0, fileName.lastIndexOf('.'))
            : fileName;
    }

    private String extractAndroidApiVersion(String path) {
        if (path.contains("android-")) {
            int start = path.indexOf("android-") + 8;
            int end = path.indexOf("/", start);
            if (end == -1)
                end = path.length();
            return path.substring(start, end);
        }
        return "unknown";
    }

    private Library.LibraryType determineLibraryType(
        io.yamsergey.adt.tools.android.model.dependency.Dependency dependency) {
        return switch (dependency) {
            case GradleJarDependency jar -> Library.LibraryType.jar;
            case GradleAarDependency aar -> Library.LibraryType.jar;
            case AndroidProjectDependency androidProject -> throw new IllegalStateException("ProjectDependency should not be converted to Library");
            case GenericProjectDependency genericProject -> throw new IllegalStateException("ProjectDependency should not be converted to Library");
            case LocalJarDependency localJar -> Library.LibraryType.jar;
            case ClassFolderDependency classFolder -> Library.LibraryType.directory;
        };
    }
}
