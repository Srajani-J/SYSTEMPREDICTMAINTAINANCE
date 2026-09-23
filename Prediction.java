public class Prediction {

    public static void main(String[] args) {

        // Machine information
        String machineId = "M001";
        String machineType = "Motor / Pump";

        // Sensor readings
        double temperature = 70.0;
        double vibration = 5.0;
        double pressure = 92.0;
        double operatingHours = 4250.0;

        // Safety limits
        double temperatureLimit = 80.0;
        double vibrationLimit = 6.0;

        // Prediction variables
        String riskLevel;
        String predictedFailure;
        String recommendation;

        // Prediction logic
        if (temperature > temperatureLimit || vibration > vibrationLimit) {

            riskLevel = "HIGH";
            predictedFailure = "Motor overheating / bearing failure";
            recommendation = "Schedule preventive maintenance immediately.";

        } else {

            riskLevel = "LOW";
            predictedFailure = "No immediate failure detected";
            recommendation = "Continue normal monitoring.";
        }

        // Display the result
        System.out.println("====================================");
        System.out.println("       SMARTPREDICT REPORT");
        System.out.println("====================================");

        System.out.println("Machine ID       : " + machineId);
        System.out.println("Machine Type     : " + machineType);

        System.out.println("------------------------------------");
        System.out.println("Temperature      : " + temperature + " °C");
        System.out.println("Vibration        : " + vibration + " mm/s");
        System.out.println("Pressure         : " + pressure + " PSI");
        System.out.println("Operating Hours  : " + operatingHours + " hrs");

        System.out.println("------------------------------------");
        System.out.println("Failure Risk     : " + riskLevel);
        System.out.println("Predicted Failure: " + predictedFailure);
        System.out.println("Recommendation   : " + recommendation);

        System.out.println("====================================");
    }
}