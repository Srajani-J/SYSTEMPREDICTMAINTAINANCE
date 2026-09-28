package com.smartpredict;

public class SensorReading {

   private final String readingId;
private final String machineId;
private final String timestamp;
private final double temperature;
private final double vibration;
private final double pressure;
private final double rpm;

    public SensorReading(String readingId, String machineId,
                         String timestamp, double temperature,
                         double vibration, double pressure,
                         double rpm) {

        this.readingId = readingId;
        this.machineId = machineId;
        this.timestamp = timestamp;
        this.temperature = temperature;
        this.vibration = vibration;
        this.pressure = pressure;
        this.rpm = rpm;
    }

    public String getReadingId() {
        return readingId;
    }

    public String getMachineId() {
        return machineId;
    }

    public String getTimestamp() {
        return timestamp;
    }

    public double getTemperature() {
        return temperature;
    }

    public double getVibration() {
        return vibration;
    }

    public double getPressure() {
        return pressure;
    }

    public double getRpm() {
        return rpm;
    }

    @Override
    public String toString() {
        return "SensorReading{" +
                "readingId='" + readingId + '\'' +
                ", machineId='" + machineId + '\'' +
                ", timestamp='" + timestamp + '\'' +
                ", temperature=" + temperature +
                ", vibration=" + vibration +
                ", pressure=" + pressure +
                ", rpm=" + rpm +
                '}';
    }
}