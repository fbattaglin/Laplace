from fastapi import APIRouter, HTTPException, UploadFile

from laplace.models.schemas import (
    DatasetMeta,
    DatasetSelection,
    TimeSeriesData,
    UploadResponse,
)
from laplace.services.parser import (
    PRELOADED_DATASETS,
    build_upload_response,
    detect_columns,
    list_preloaded,
    load_preloaded,
    parse_upload,
    validate_and_prepare,
)

router = APIRouter(prefix="/api/datasets", tags=["datasets"])

MAX_UPLOAD_SIZE = 10 * 1024 * 1024  # 10MB


@router.get("", response_model=list[DatasetMeta])
async def get_datasets():
    return list_preloaded()


@router.get("/{name}", response_model=TimeSeriesData)
async def get_dataset(name: str):
    if name not in PRELOADED_DATASETS:
        raise HTTPException(status_code=404, detail=f"Dataset '{name}' not found")

    meta = PRELOADED_DATASETS[name]
    df = load_preloaded(name)
    detection = detect_columns(df)

    return validate_and_prepare(
        df=df,
        datetime_col=detection.datetime_col,
        target_col=detection.target_col,
        frequency=meta["frequency"],
        name=name,
    )


@router.post("/upload", response_model=UploadResponse)
async def upload_dataset(file: UploadFile):
    if not file.filename:
        raise HTTPException(status_code=422, detail="No filename provided")

    content = await file.read()
    if len(content) > MAX_UPLOAD_SIZE:
        raise HTTPException(status_code=413, detail="File too large (max 10MB)")

    try:
        df = parse_upload(content, file.filename)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from None

    if df.empty:
        raise HTTPException(status_code=422, detail="File contains no data")

    return build_upload_response(df)


@router.post("/confirm", response_model=TimeSeriesData)
async def confirm_dataset(selection: DatasetSelection):
    try:
        if selection.source == "preloaded":
            if not selection.dataset_name:
                raise HTTPException(status_code=422, detail="dataset_name required for preloaded")
            df = load_preloaded(selection.dataset_name)
            name = selection.dataset_name
        else:
            raise HTTPException(
                status_code=422,
                detail="For uploaded data, use /upload first then /confirm with the response",
            )
    except (ValueError, FileNotFoundError) as e:
        raise HTTPException(status_code=404, detail=str(e)) from None

    try:
        return validate_and_prepare(
            df=df,
            datetime_col=selection.datetime_col,
            target_col=selection.target_col,
            frequency=selection.frequency,
            name=name,
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from None
