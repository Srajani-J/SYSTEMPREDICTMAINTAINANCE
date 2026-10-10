// =====================================
// SmartPredict Dashboard
// Dashboard & Monitoring
// Member 3
// =====================================



// =====================================
// Machine Data
// =====================================

const machineData = {

    "Machine 01": {

        health: 94,

        temperature: 72.4,

        vibration: 3.2,

        pressure: 6.8,

        rpm: 1450

    },


    "Machine 02": {

        health: 58,

        temperature: 82.6,

        vibration: 5.4,

        pressure: 7.4,

        rpm: 1650

    },


    "Machine 03": {

        health: 25,

        temperature: 95.5,

        vibration: 8.7,

        pressure: 9.2,

        rpm: 1900

    }

};



// =====================================
// Chart Variable
// =====================================

let sensorChart = null;



// =====================================
// Get Machine Status
// =====================================

function getMachineStatus(health) {

    if (health >= 70) {

        return "HEALTHY";

    }

    else if (health >= 40) {

        return "WARNING";

    }

    else {

        return "CRITICAL";

    }

}



// =====================================
// Update Dashboard
// =====================================

function updateDashboard() {

    const machineSelect =
        document.getElementById(
            "machineSelect"
        );


    const selectedMachine =
        machineSelect.value;


    const machine =
        machineData[selectedMachine];


    if (!machine) {

        return;

    }



    // =========================
    // Machine Status
    // =========================

    const status =
        getMachineStatus(
            machine.health
        );



    // =========================
    // Machine Name
    // =========================

    document.getElementById(
        "machineName"
    ).textContent =
        selectedMachine;



    // =========================
    // Health Percentage
    // =========================

    document.getElementById(
        "healthValue"
    ).textContent =
        machine.health + "%";



    // =========================
    // Status
    // =========================

    const statusElement =
        document.getElementById(
            "machineStatus"
        );


    statusElement.textContent =
        status;


    // Remove previous classes

    statusElement.classList.remove(
        "healthy",
        "warning",
        "critical"
    );


    // Add correct class

    if (status === "HEALTHY") {

        statusElement.classList.add(
            "healthy"
        );

    }

    else if (status === "WARNING") {

        statusElement.classList.add(
            "warning"
        );

    }

    else {

        statusElement.classList.add(
            "critical"
        );

    }



    // =========================
    // Health Number Color
    // =========================

    const healthValue =
        document.getElementById(
            "healthValue"
        );


    if (status === "HEALTHY") {

        healthValue.style.color =
            "#16a34a";

    }

    else if (status === "WARNING") {

        healthValue.style.color =
            "#f59e0b";

    }

    else {

        healthValue.style.color =
            "#dc2626";

    }



    // =========================
    // Sensor Values
    // =========================

    document.getElementById(
        "temperature"
    ).textContent =
        machine.temperature + " °C";


    document.getElementById(
        "vibration"
    ).textContent =
        machine.vibration + " mm/s";


    document.getElementById(
        "pressure"
    ).textContent =
        machine.pressure + " bar";


    document.getElementById(
        "rpm"
    ).textContent =
        machine.rpm + " RPM";



    // =========================
    // Update Alert
    // =========================

    updateAlert(
        selectedMachine,
        status
    );



    // =========================
    // Update Chart
    // =========================

    updateChart(machine);

}



// =====================================
// Alert System
// =====================================

function updateAlert(
    machineName,
    status
) {

    const alertBox =
        document.getElementById(
            "alertBox"
        );


    const alertTitle =
        document.getElementById(
            "alertTitle"
        );


    const alertMessage =
        document.getElementById(
            "alertMessage"
        );



    // =========================
    // Healthy
    // =========================

    if (status === "HEALTHY") {

        alertBox.style.borderLeftColor =
            "#16a34a";


        alertTitle.textContent =
            "System Normal";


        alertTitle.style.color =
            "#16a34a";


        alertMessage.textContent =
            machineName +
            " is operating normally.";

    }



    // =========================
    // Warning
    // =========================

    else if (status === "WARNING") {

        alertBox.style.borderLeftColor =
            "#f59e0b";


        alertTitle.textContent =
            "WARNING ALERT";


        alertTitle.style.color =
            "#f59e0b";


        alertMessage.textContent =
            machineName +
            " requires attention. Sensor values are above normal levels.";

    }



    // =========================
    // Critical
    // =========================

    else {

        alertBox.style.borderLeftColor =
            "#dc2626";


        alertTitle.textContent =
            "CRITICAL ALERT";


        alertTitle.style.color =
            "#dc2626";


        alertMessage.textContent =
            machineName +
            " is in critical condition. Immediate maintenance is recommended.";

    }

}



// =====================================
// Sensor Trend Chart
// =====================================

function updateChart(machine) {

    const canvas =
        document.getElementById(
            "sensorChart"
        );


    if (!canvas) {

        return;

    }


    const ctx =
        canvas.getContext("2d");



    // Destroy previous chart

    if (sensorChart !== null) {

        sensorChart.destroy();

    }



    // Temperature trend data

    const temperatureData = [

        machine.temperature - 4,

        machine.temperature - 3,

        machine.temperature - 2,

        machine.temperature - 1,

        machine.temperature

    ];



    // Create chart

    sensorChart = new Chart(
        ctx,
        {

            type: "line",


            data: {

                labels: [

                    "10:00",

                    "10:10",

                    "10:20",

                    "10:30",

                    "10:40"

                ],


                datasets: [

                    {

                        label:
                            "Temperature (°C)",


                        data:
                            temperatureData,


                        borderWidth: 3,


                        tension: 0.3,


                        fill: false

                    }

                ]

            },


            options: {

                responsive: true,


                maintainAspectRatio: false,


                plugins: {

                    legend: {

                        display: true

                    }

                },


                scales: {

                    y: {

                        beginAtZero: false

                    }

                }

            }

        }
    );

}



// =====================================
// Machine Selection Event
// =====================================

document
    .getElementById(
        "machineSelect"
    )
    .addEventListener(
        "change",
        updateDashboard
    );



// =====================================
// Start Dashboard
// =====================================

document.addEventListener(
    "DOMContentLoaded",
    function () {

        updateDashboard();

    }
);