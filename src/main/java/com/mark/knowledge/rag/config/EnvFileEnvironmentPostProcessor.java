package com.mark.knowledge.rag.config;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.env.EnvironmentPostProcessor;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.MapPropertySource;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.LinkedHashMap;
import java.util.Map;

public class EnvFileEnvironmentPostProcessor implements EnvironmentPostProcessor {

    @Override
    public void postProcessEnvironment(ConfigurableEnvironment environment, SpringApplication application) {
        Path envFile = findEnvFile();
        if (envFile == null || !Files.exists(envFile)) {
            return;
        }

        Map<String, Object> props = parseEnvFile(envFile);
        if (!props.isEmpty()) {
            MapPropertySource source = new MapPropertySource("envFile", props);
            // Insert after system env vars so Docker overrides take precedence
            environment.getPropertySources().addAfter("systemEnvironment", source);
        }
    }

    private Path findEnvFile() {
        String explicit = System.getenv("ENV_FILE_PATH");
        if (explicit != null) {
            return Paths.get(explicit);
        }
        Path docker = Paths.get("/workspace/.env");
        if (Files.exists(docker)) {
            return docker;
        }
        return Paths.get(".env");
    }

    private Map<String, Object> parseEnvFile(Path file) {
        Map<String, Object> props = new LinkedHashMap<>();
        try {
            for (String line : Files.readAllLines(file)) {
                line = line.trim();
                if (line.isEmpty() || line.startsWith("#")) {
                    continue;
                }
                int eq = line.indexOf('=');
                if (eq > 0) {
                    String key = line.substring(0, eq).trim();
                    String value = line.substring(eq + 1).trim();
                    if (value.length() >= 2
                            && ((value.startsWith("\"") && value.endsWith("\""))
                            || (value.startsWith("'") && value.endsWith("'")))) {
                        value = value.substring(1, value.length() - 1);
                    }
                    props.put(key, value);
                }
            }
        } catch (IOException ignored) {
        }
        return props;
    }
}
