/*
 * Original work Copyright (c) yamsergey
 * Modified work Copyright (c) 2026 Zny-Official
 *
 * Licensed under the GNU Lesser General Public License v3.0
 * This file has been modified to support Compose compiler plugin.
 * See LICENSE.txt for details.
 */
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
