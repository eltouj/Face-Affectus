import cv2
import tkinter as tk
from tkinter import messagebox
from functions.app_design import app_theme, style_button, style_label, style_listbox, COLORS
from functions.camera_utils import get_available_cameras
from functions.emotion_engine import EmotionEngine

class FaceAffectusApp:
    def __init__(self, root):
        self.root = root
        self.root.title("Face Affectus")
        self.root.withdraw() # Hide root until selection is made
        app_theme(self.root)
        
        self.engine = EmotionEngine()
        self.selected_camera_id = None
        
        # Start camera selection
        self.create_selection_window()

    def create_selection_window(self):
        selection_window = tk.Toplevel(self.root)
        selection_window.title("Face Affectus - Select Camera")
        selection_window.geometry("480x400")
        selection_window.configure(bg=COLORS['primary'])
        
        # Title
        title_label = tk.Label(selection_window, text="Welcome to Face Affectus")
        style_label(title_label, variant='title')
        title_label.pack(pady=(30, 10))
        
        subtitle_label = tk.Label(selection_window, text="Please select your active camera device")
        style_label(subtitle_label)
        subtitle_label.pack(pady=(0, 20))

        # Camera List
        list_frame = tk.Frame(selection_window, bg=COLORS['primary'])
        list_frame.pack(padx=40, pady=10, fill='both', expand=True)
        
        self.listbox = tk.Listbox(list_frame)
        style_listbox(self.listbox)
        self.listbox.pack(side='left', fill='both', expand=True)
        
        scrollbar = tk.Scrollbar(list_frame, orient="vertical", command=self.listbox.yview)
        # Style scrollbar via primary color (limited in basic tkinter, but okay)
        scrollbar.pack(side='right', fill='y')
        self.listbox.config(yscrollcommand=scrollbar.set)

        self.refresh_camera_list()

        # Buttons
        btn_frame = tk.Frame(selection_window, bg=COLORS['primary'])
        btn_frame.pack(pady=30)

        select_btn = tk.Button(btn_frame, text="LAUNCH APPLICATION", command=lambda: self.on_select(selection_window))
        style_button(select_btn)
        select_btn.pack(side='left', padx=10)

        refresh_btn = tk.Button(btn_frame, text="Refresh Devices", command=self.refresh_camera_list, bg=COLORS['secondary'])
        style_button(refresh_btn)
        refresh_btn.configure(bg=COLORS['secondary']) # Overwrite default accent for refresh
        refresh_btn.pack(side='left', padx=10)

        selection_window.protocol("WM_DELETE_WINDOW", self.root.destroy)
        selection_window.grab_set()

    def refresh_camera_list(self):
        self.listbox.delete(0, tk.END)
        self.cameras = get_available_cameras()
        if not self.cameras:
            self.listbox.insert(tk.END, "No cameras detected!")
        else:
            for cam in self.cameras:
                self.listbox.insert(tk.END, f"  {cam['name']}")
            self.listbox.select_set(0)

    def on_select(self, window):
        selection = self.listbox.curselection()
        if not selection or not self.cameras:
            messagebox.showwarning("Warning", "Please select a valid camera device.")
            return
            
        self.selected_camera_id = self.cameras[selection[0]]['id']
        window.destroy()
        self.run_engine()

    def run_engine(self):
        cap = cv2.VideoCapture(self.selected_camera_id)
        if not cap.isOpened():
            messagebox.showerror("Error", "Could not open selected camera.")
            self.root.destroy()
            return

        print(f"Starting Face Affectus with camera {self.selected_camera_id}")
        
        while True:
            ret, frame = cap.read()
            if not ret:
                break

            # Process frame using the modular engine
            processed_frame, _ = self.engine.process_frame(frame)

            # Show image
            cv2.imshow('Face Affectus (space to exit)', processed_frame)

            # If user presses 'space', exit loop
            if cv2.waitKey(1) & 0xFF == ord(' '):
                break

        cap.release()
        cv2.destroyAllWindows()
        self.root.destroy()

if __name__ == "__main__":
    root = tk.Tk()
    app = FaceAffectusApp(root)
    root.mainloop()