# Run backend bound to all interfaces so other machines on the network can connect
# Other users: open http://<THIS_MACHINE_IP>:8000 (e.g. http://192.168.1.100:8000)
& "$PSScriptroot\venv\Scripts\Activate.ps1"
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
