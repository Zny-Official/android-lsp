package io.yamsergey.adt.cli.workspace;

import java.io.File;
import java.util.concurrent.Callable;

import io.yamsergey.adt.tools.android.model.project.Project;
import io.yamsergey.adt.tools.android.resolver.AndroidProjectResolver;
import io.yamsergey.adt.workspace.kotlin.converter.ConverterConfig;
import io.yamsergey.adt.workspace.kotlin.converter.ProjectToWorkspaceConverter;
import io.yamsergey.adt.workspace.kotlin.model.Workspace;
import io.yamsergey.adt.workspace.kotlin.serializer.WorkspaceJsonSerializer;
import io.yamsergey.adt.tools.sugar.Failure;
import io.yamsergey.adt.tools.sugar.Success;
import picocli.CommandLine.Command;
import picocli.CommandLine.Option;
import picocli.CommandLine.Parameters;

@Command(name = "workspace", description = "Generate workspace.json for Kotlin Language Server")
public class WorkspaceCommand implements Callable<Integer> {

    @Parameters(index = "0", arity = "0..1", description = "Android project directory path (default: current directory)")
    private String projectPath = ".";

    @Option(names = { "--output" }, description = "Filepath where workspace.json will be stored.")
    private String outputFilePath = "workspace.json";

    @Option(names = { "--compose" }, 
            description = "Enable Compose compiler plugin support (default: true)",
            defaultValue = "true",
            fallbackValue = "true",
            negatable = true)
    private boolean enableCompose = true;

    @Option(names = { "--sources" }, 
            description = "Attach source JARs from Gradle cache (default: true)",
            defaultValue = "true",
            fallbackValue = "true",
            negatable = true)
    private boolean attachSources = true;

    @Option(names = { "--jvm-target" }, 
            description = "JVM target version for Kotlin compiler (default: 21)",
            defaultValue = "21")
    private String jvmTarget = "21";

    @Override
    public Integer call() throws Exception {

        File projectDir = new File(projectPath);

        if (!projectDir.exists() || !projectDir.isDirectory()) {
            System.err.println("Error: Project directory does not exist: " + projectPath);
            return 1;
        }

        AndroidProjectResolver resolver = new AndroidProjectResolver(projectPath);
        var resolvedProjectResult = resolver.resolve();

        return switch (resolvedProjectResult) {
            case Success<Project> project -> {
                try {
                    ConverterConfig config = new ConverterConfig(
                        enableCompose,
                        attachSources,
                        jvmTarget
                    );

                    ProjectToWorkspaceConverter converter = new ProjectToWorkspaceConverter(config);
                    Workspace workspace = converter.convert(project.value());

                    WorkspaceJsonSerializer serializer = new WorkspaceJsonSerializer();
                    File outputFile = new File(outputFilePath);
                    serializer.toJsonFile(workspace, outputFile);

                    System.out.println("Workspace.json generated successfully: " + outputFile.getAbsolutePath());
                    
                    if (enableCompose) {
                        System.out.println("  - Compose compiler plugin: enabled (JVM target: " + jvmTarget + ")");
                    }
                    if (attachSources) {
                        System.out.println("  - Source JARs attachment: enabled");
                    }
                    
                    yield 0;
                } catch (Exception e) {
                    System.err.println("Error generating workspace.json: " + e.getMessage());
                    e.printStackTrace();
                    yield 1;
                }
            }
            case Failure<Project> failure -> {
                System.err.println("Failed to resolve Android project: " + failure.description());
                if (failure.cause() != null) {
                    System.err.println("Cause: " + failure.cause().getMessage());
                }
                yield 1;
            }

            default -> {
                System.err.println(String.format("Unknown results for: %s", projectPath));
                yield 1;
            }
        };
    }
}
