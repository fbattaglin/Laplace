import psutil
import os

print(f"Total Memory: {psutil.virtual_memory().total / (1024**3):.2f} GB")
print(f"Available Memory: {psutil.virtual_memory().available / (1024**3):.2f} GB")
print(f"Memory Percent Used: {psutil.virtual_memory().percent}%")

