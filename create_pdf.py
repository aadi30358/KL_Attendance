from PIL import Image
import os

def create_pdf(image_path, output_path):
    try:
        image = Image.open(image_path)
        if image.mode == 'RGBA':
            image = image.convert('RGB')
        image.save(output_path, "PDF", resolution=100.0)
        print(f"Successfully created PDF at {output_path}")
    except Exception as e:
        print(f"Error creating PDF: {e}")

if __name__ == "__main__":
    create_pdf("public/academic_calendar.jpg", "public/academic_calendar.pdf")
