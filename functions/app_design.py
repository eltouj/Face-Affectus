# Design System for Face-Affectus

COLORS = {
    'primary': '#2B2D42',    # Dark Navy
    'secondary': '#8D99AE',  # Cool Gray
    'accent': '#EF233C',     # Red
    'light': '#EDF2F4',      # Off White
    'white': '#FFFFFF',
    'dark': '#212529'
}

def app_theme(root):
    root.configure(bg=COLORS['primary'])
    root.tk_setPalette(background=COLORS['primary'], foreground=COLORS['white'])

def style_button(button):
    button.configure(
        bg=COLORS['accent'],
        fg=COLORS['white'],
        font=("Helvetica", 10, "bold"),
        activebackground=COLORS['secondary'],
        activeforeground=COLORS['white'],
        relief='flat',
        padx=20,
        pady=10,
        cursor='hand2'
    )

def style_label(label, variant='normal'):
    if variant == 'title':
        label.configure(
            bg=COLORS['primary'],
            fg=COLORS['white'],
            font=("Helvetica", 16, "bold")
        )
    else:
        label.configure(
            bg=COLORS['primary'],
            fg=COLORS['secondary'],
            font=("Helvetica", 10)
        )

def style_listbox(listbox):
    listbox.configure(
        bg=COLORS['dark'],
        fg=COLORS['white'],
        font=("Helvetica", 10),
        selectbackground=COLORS['accent'],
        selectforeground=COLORS['white'],
        relief='flat',
        borderwidth=0,
        highlightthickness=1,
        highlightbackground=COLORS['secondary']
    )
