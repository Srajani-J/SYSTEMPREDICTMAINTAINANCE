package com.smartpredict;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.sql.Statement;

public class Database {

    private static final String URL = "jdbc:sqlite:smartpredict.db";

    public static Connection connect() throws SQLException {
        return DriverManager.getConnection(URL);
    }

    public static void createTables() {

        String machineTable = """
                CREATE TABLE IF NOT EXISTS machine (
                    machine_id TEXT PRIMARY KEY,
                    machine_name TEXT NOT NULL,
                    machine_type TEXT NOT NULL,
                    location TEXT,
                    status TEXT
                );
                """;

        String sensorReadingTable = """
                CREATE TABLE IF NOT EXISTS sensor_reading (
                    reading_id TEXT PRIMARY KEY,
                    machine_id TEXT NOT NULL,
                    timestamp TEXT NOT NULL,
                    temperature REAL,
                    vibration REAL,
                    pressure REAL,
                    rpm REAL,
                    FOREIGN KEY (machine_id) REFERENCES machine(machine_id)
                );
                """;

        try (Connection connection = connect();
             Statement statement = connection.createStatement()) {

            statement.execute(machineTable);
            statement.execute(sensorReadingTable);

            System.out.println("Database tables created successfully.");

        } catch (SQLException e) {
            System.out.println("Database error: " + e.getMessage());
        }
    }

    public static void addSampleMachines() {

        String sql = """
                INSERT OR IGNORE INTO machine
                (machine_id, machine_name, machine_type, location, status)
                VALUES (?, ?, ?, ?, ?)
                """;

        try (Connection connection = connect();
             PreparedStatement statement = connection.prepareStatement(sql)) {

            statement.setString(1, "M001");
            statement.setString(2, "CNC Machine 1");
            statement.setString(3, "CNC");
            statement.setString(4, "Factory-A");
            statement.setString(5, "ACTIVE");
            statement.executeUpdate();

            statement.setString(1, "M002");
            statement.setString(2, "Lathe Machine 1");
            statement.setString(3, "LATHE");
            statement.setString(4, "Factory-A");
            statement.setString(5, "ACTIVE");
            statement.executeUpdate();

            System.out.println("Sample machines added successfully.");

        } catch (SQLException e) {
            System.out.println("Machine insertion error: " + e.getMessage());
        }
    }

    public static void addSampleSensorReadings() {

        String sql = """
                INSERT OR IGNORE INTO sensor_reading
                (reading_id, machine_id, timestamp, temperature,
                 vibration, pressure, rpm)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """;

        try (Connection connection = connect();
             PreparedStatement statement = connection.prepareStatement(sql)) {

            statement.setString(1, "R001");
            statement.setString(2, "M001");
            statement.setString(3, "2026-09-28 10:00:00");
            statement.setDouble(4, 72.5);
            statement.setDouble(5, 4.2);
            statement.setDouble(6, 5.8);
            statement.setDouble(7, 1500);
            statement.executeUpdate();

            statement.setString(1, "R002");
            statement.setString(2, "M001");
            statement.setString(3, "2026-09-28 11:00:00");
            statement.setDouble(4, 75.1);
            statement.setDouble(5, 4.5);
            statement.setDouble(6, 5.9);
            statement.setDouble(7, 1520);
            statement.executeUpdate();

            statement.setString(1, "R003");
            statement.setString(2, "M002");
            statement.setString(3, "2026-09-28 10:30:00");
            statement.setDouble(4, 68.3);
            statement.setDouble(5, 3.1);
            statement.setDouble(6, 6.2);
            statement.setDouble(7, 1400);
            statement.executeUpdate();

            System.out.println("Sample sensor readings added successfully.");

        } catch (SQLException e) {
            System.out.println("Sensor reading insertion error: " + e.getMessage());
        }
    }
public static void verifyData() {

    String machineQuery = "SELECT * FROM machine";
    String sensorQuery = "SELECT * FROM sensor_reading";

    try (Connection connection = connect();
         Statement statement = connection.createStatement()) {

        System.out.println("\n===== MACHINES =====");

        var machineResult = statement.executeQuery(machineQuery);

        while (machineResult.next()) {
            System.out.println(
                    machineResult.getString("machine_id") + " | " +
                    machineResult.getString("machine_name") + " | " +
                    machineResult.getString("machine_type") + " | " +
                    machineResult.getString("location") + " | " +
                    machineResult.getString("status")
            );
        }

        System.out.println("\n===== SENSOR READINGS =====");

        var sensorResult = statement.executeQuery(sensorQuery);

        while (sensorResult.next()) {
            System.out.println(
                    sensorResult.getString("reading_id") + " | " +
                    sensorResult.getString("machine_id") + " | " +
                    sensorResult.getString("timestamp") + " | " +
                    sensorResult.getDouble("temperature") + " | " +
                    sensorResult.getDouble("vibration") + " | " +
                    sensorResult.getDouble("pressure") + " | " +
                    sensorResult.getDouble("rpm")
            );
        }

    } catch (SQLException e) {
        System.out.println("Verification error: " + e.getMessage());
    }
}}