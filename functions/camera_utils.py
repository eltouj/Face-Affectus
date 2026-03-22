from pygrabber.dshow_graph import FilterGraph

def get_available_cameras():
    """
    Returns a list of dictionaries containing 'id' and 'name' of available cameras.
    """
    devices = FilterGraph().get_input_devices()
    available_cameras = []
    for i, name in enumerate(devices):
        available_cameras.append({'id': i, 'name': name})
    return available_cameras
