from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException
from bs4 import BeautifulSoup
import uvicorn
import os

app = FastAPI(title="KLE Tech ERP Proxy API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class LoginRequest(BaseModel):
    username: str
    dob: str  # Format: YYYY-MM-DD

def get_months():
    return {
        '01':'Jan', '02':'Feb', '03':'Mar', '04':'Apr',
        '05':'May', '06':'Jun', '07':'Jul', '08':'Aug',
        '09':'Sep', '10':'Oct', '11':'Nov', '12':'Dec'
    }

def get_driver():
    chrome_options = Options()
    chrome_options.add_argument('--headless')
    chrome_options.add_argument('--no-sandbox')
    chrome_options.add_argument('--disable-dev-shm-usage')
    chrome_options.add_argument('--disable-gpu')
    chrome_options.add_argument("user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
    
    if os.name == 'nt':
        driver = webdriver.Chrome(options=chrome_options)
    else:
        chrome_service = Service('/usr/bin/chromedriver') if os.path.exists('/usr/bin/chromedriver') else Service()
        driver = webdriver.Chrome(service=chrome_service, options=chrome_options)
    
    return driver

@app.post("/fetch_attendance")
async def fetch_attendance(req: LoginRequest):
    driver = None
    try:
        driver = get_driver()
        login_url = 'https://student.kletech.ac.in/code/'
        driver.get(login_url)

        try:
            passlist = req.dob.split('-')
            dd = passlist[2]
            mm = get_months()[passlist[1]]
            yyyy = passlist[0]
        except (IndexError, KeyError):
            raise HTTPException(status_code=400, detail="Invalid DOB format. Use YYYY-MM-DD")

        wait = WebDriverWait(driver, 15)
        
        username_field = wait.until(EC.presence_of_element_located((By.ID, 'username')))
        dd_field = driver.find_element(By.ID, 'dd')
        mm_field = driver.find_element(By.ID, 'mm')
        yyyy_field = driver.find_element(By.ID, 'yyyy')

        username_field.send_keys(req.username)
        dd_field.send_keys(dd)
        mm_field.send_keys(mm)
        yyyy_field.send_keys(yyyy)

        submit_button = wait.until(EC.element_to_be_clickable((By.NAME, 'submit')))
        submit_button.click()

        try:
            wait.until(EC.presence_of_element_located((By.ID, 'page_bg')))
        except TimeoutException:
            if "Invalid" in driver.page_source or "wrong" in driver.page_source.lower():
                raise HTTPException(status_code=401, detail="Invalid Credentials")
            raise HTTPException(status_code=504, detail="Timeout waiting for dashboard")

        dashboard_url = 'https://student.kletech.ac.in/code/index.php?option=com_studentdashboard&controller=studentdashboard&task=dashboard'
        driver.get(dashboard_url)
        wait.until(EC.presence_of_element_located((By.ID, 'page-header')))
        
        soup = BeautifulSoup(driver.page_source, 'html.parser')

        personal_keys = ["name", "usn", "semester", "credits_earned", "credits_to_earn"]
        personal_values = [div.text.strip().replace("Credits Earned : ", "").replace("Credits to Earn : ", "") 
                        for div in soup.find_all('div', {'class': 'tname2'})]
        personal_data = dict(zip(personal_keys, personal_values))

        course_codes = [div.text for div in soup.find_all('div', {'class': 'courseCode'})]
        course_names = [div.text for div in soup.find_all('div', {'class': 'coursename'})]
        course_teachers = [div.text.strip().replace("  ", " ") for div in soup.find_all('div', {'class': 'tname'})]
        course_attendances = [div.text.strip().replace("Attendance", "").replace("\n", "") for div in soup.find_all('div', {'class': 'att'})]
        course_cie_marks = [div.text.strip().replace("Internal Assessment", "").replace("\n", "") for div in soup.find_all('div', {'class': 'cie'})]

        attendance_data = []
        j = 0
        for i in range(len(course_names)):
            if i == 0 or course_names[i] != course_names[i-1]:
                attendance_data.append({
                    "course_name": course_names[i],
                    "course_code": course_codes[i],
                    "course_teacher": course_teachers[j] if j < len(course_teachers) else "N/A",
                    "course_attendance": course_attendances[i],
                    "cie_marks": course_cie_marks[i]
                })
                j += 1

        return {
            "personal_data": personal_data,
            "attendance_data": attendance_data
        }

    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if driver:
            driver.quit()

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
