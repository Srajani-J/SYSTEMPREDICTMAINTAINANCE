package com.smartpredict;

public class Machine {

   private final String machineId;
private final String machineName;
private final String machineType;
private final String location;
private String status;
    public Machine(String machineId, String machineName,
                   String machineType, String location,
                   String status) {

        this.machineId = machineId;
        this.machineName = machineName;
        this.machineType = machineType;
        this.location = location;
        this.status = status;
    }

    public String getMachineId() {
        return machineId;
    }

    public String getMachineName() {
        return machineName;
    }

    public String getMachineType() {
        return machineType;
    }

    public String getLocation() {
        return location;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    @Override
    public String toString() {
        return "Machine{" +
                "machineId='" + machineId + '\'' +
                ", machineName='" + machineName + '\'' +
                ", machineType='" + machineType + '\'' +
                ", location='" + location + '\'' +
                ", status='" + status + '\'' +
                '}';
    }
}