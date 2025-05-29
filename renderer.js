const statusDataElement = document.getElementById('statusData');
const workloadInput = document.getElementById('workload');
const periodInput = document.getElementById('period');
const deadlineInput = document.getElementById('deadline');
const setWorkloadBtn = document.getElementById('setWorkloadBtn');
const setPeriodBtn = document.getElementById('setPeriodBtn');
const setDeadlineBtn = document.getElementById('setDeadlineBtn');
const statusMessageElement = document.getElementById('statusMessage');

let paramPaths = {};

async function fetchParamPaths() {
    try {
        paramPaths = await window.electronAPI.getParamPaths();
        // console.log('Fetched parameter paths:', paramPaths);
        // Populate input fields with current values from proc file if possible, or defaults.
        // This requires reading the proc file first, then setting the input fields.
        // We will also fetch the initial values from the proc file and populate the inputs.
        await updateData(); // Initial data load will also populate inputs.
    } catch (error) {
        console.error('Failed to fetch parameter paths:', error);
        displayStatusMessage('Error: Could not load initial parameter paths. Controls may not work.', 'error');
    }
}

function displayStatusMessage(message, type = 'info') {
    statusMessageElement.textContent = message;
    statusMessageElement.className = 'status-message'; // Reset classes
    if (type === 'success') {
        statusMessageElement.classList.add('success');
    } else if (type === 'error') {
        statusMessageElement.classList.add('error');
    }
}

async function handleSetParam(paramPath, value, paramName) {
    if (!value || value <=0) {
        displayStatusMessage(`Error: ${paramName} must be a positive number.`, 'error');
        return;
    }
    try {
        // console.log(`Renderer: Writing ${paramName} (${value}) to ${paramPath}`);
        const result = await window.electronAPI.writeSysParam(paramPath, value, paramName);
        if (result.success) {
            displayStatusMessage(result.message, 'success');
            // console.log(`${paramName} set successfully:`, result.message);
            await updateData(); // Refresh data after successful set
        } else {
            let detailedError = result.error;
            if (result.code === 'EACCES') {
                detailedError = `Permission denied. Try running with sudo/administrator privileges. (Path: ${paramPath})`;
            }
            if (result.code === 'ENOENT') {
                detailedError = `Parameter file not found. Is the kernel module loaded? (Path: ${paramPath})`;
            }
            displayStatusMessage(`Error setting ${paramName}: ${detailedError}`, 'error');
            console.error(`Error setting ${paramName}:`, result);
        }
    } catch (error) {
        displayStatusMessage(`IPC Error setting ${paramName}: ${error.message}`, 'error');
        console.error(`IPC Error setting ${paramName}:`, error);
    }
}

setWorkloadBtn.addEventListener('click', () => {
    if (paramPaths.workload) {
        handleSetParam(paramPaths.workload, workloadInput.value, 'Simulated Workload');
    } else {
        displayStatusMessage('Workload path not loaded.', 'error');
    }
});

setPeriodBtn.addEventListener('click', () => {
    if (paramPaths.period) {
        handleSetParam(paramPaths.period, periodInput.value, 'Task Period');
    } else {
        displayStatusMessage('Period path not loaded.', 'error');
    }
});

setDeadlineBtn.addEventListener('click', () => {
    if (paramPaths.deadline) {
        handleSetParam(paramPaths.deadline, deadlineInput.value, 'Task Deadline');
    } else {
        displayStatusMessage('Deadline path not loaded.', 'error');
    }
});

function updateStatusDisplay(data) {
    if (!data) {
        statusDataElement.innerHTML = '<p>Could not load status data. Is the kernel module loaded and /proc/avionics_status available?</p>';
        // Clear input fields if data cannot be loaded
        // workloadInput.value = '';
        // periodInput.value = '';
        // deadlineInput.value = '';
        return;
    }

    // Populate input fields if they are empty and data is available
    // This helps to show the current kernel values on first load.
    if (workloadInput.value === '' && data.CurrentWorkloadMS) {
        workloadInput.value = data.CurrentWorkloadMS;
    }
    if (periodInput.value === '' && data.PeriodMS) {
        periodInput.value = data.PeriodMS;
    }
    if (deadlineInput.value === '' && data.DeadlineMS) {
        deadlineInput.value = data.DeadlineMS;
    }

    statusDataElement.innerHTML = ''; // Clear previous data

    const keyOrder = [
        "TaskName", "ModuleStatus", "TaskStatus", "PeriodMS", "DeadlineMS", "CurrentWorkloadMS",
        "LastExecTimeMS", "LastDeadlineResult", "MetCount", "MissedCount"
    ];

    keyOrder.forEach(key => {
        if (data.hasOwnProperty(key)) {
            const value = data[key];
            const keyDiv = document.createElement('div');
            keyDiv.classList.add('data-key');
            keyDiv.textContent = `${key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}:`; // Format key nicely

            const valueDiv = document.createElement('div');
            valueDiv.classList.add('data-value');
            valueDiv.textContent = value;

            if (key === 'LastDeadlineResult') {
                if (value === 'MET') valueDiv.classList.add('met');
                if (value === 'MISSED') valueDiv.classList.add('missed');
            }
            if (key === 'TaskStatus' && value === 'EXECUTING') {
                valueDiv.classList.add('executing');
            }
            if (key === 'MissedCount' && value !== '0') {
                 valueDiv.classList.add('missed-count-non-zero');
            }

            statusDataElement.appendChild(keyDiv);
            statusDataElement.appendChild(valueDiv);
        }
    });
}

async function updateData() {
    try {
        const result = await window.electronAPI.readProcFile();
        if (result.success) {
            updateStatusDisplay(result.data);
            // Only display load success message if it's not an auto-refresh
            // if(!updateData.hasRunOnce) {
            //     displayStatusMessage('Data loaded successfully.', 'success');
            //     updateData.hasRunOnce = true;
            // }
        } else {
            let errorMessage = `Error reading /proc/avionics_status: ${result.error}.`;
            if (result.code === 'ENOENT') {
                errorMessage = 'Error: /proc/avionics_status not found. Is the kernel module loaded?';
            }
            updateStatusDisplay(null); // Clear display or show error in display
            displayStatusMessage(errorMessage, 'error');
            console.error('Error reading proc file:', result);
        }
    } catch (error) {
        updateStatusDisplay(null);
        displayStatusMessage(`IPC Error reading proc file: ${error.message}`, 'error');
        console.error('IPC Error reading proc file:', error);
    }
}

// Initial load and periodic refresh
async function init() {
    await fetchParamPaths(); // Fetch paths first
    // updateData() is called by fetchParamPaths on success
    setInterval(updateData, 1000); // Refresh data every 1 second
}

init(); 