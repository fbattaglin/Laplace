import logging
import sys

def setup_logging():
    """Configures structured, unified logging for the Laplace application."""
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        handlers=[
            logging.StreamHandler(sys.stdout),
            logging.FileHandler("backend.log", mode="a", encoding="utf-8")
        ]
    )
    logger = logging.getLogger("laplace")
    logger.info("Structured logging system initialized successfully.")
