package com.smartpredict;

public class Main {

    public static void main(String[] args) {

        System.out.println("Starting SmartPredict...");

        Database.createTables();

        Database.addSampleMachines();

        Database.addSampleSensorReadings();

        Database.verifyData();

        System.out.println("\nSmartPredict database setup completed.");
    }
}