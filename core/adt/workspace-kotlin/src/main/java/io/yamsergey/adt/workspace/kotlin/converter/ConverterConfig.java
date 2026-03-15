package io.yamsergey.adt.workspace.kotlin.converter;

public record ConverterConfig(
    boolean enableComposeSupport,
    boolean attachSourceJars,
    String jvmTarget
) {
    public static ConverterConfig defaults() {
        return new ConverterConfig(true, true, "21");
    }

    public static ConverterConfig disabled() {
        return new ConverterConfig(false, false, "21");
    }
}
