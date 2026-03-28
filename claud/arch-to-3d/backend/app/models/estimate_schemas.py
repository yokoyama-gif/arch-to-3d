"""Pydantic schemas for the exterior construction cost estimation system."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


EstimateCategory = Literal["earthwork", "paving", "fence", "landscaping"]


class EstimateItemSchema(BaseModel):
    id: str
    category: EstimateCategory
    name: str
    specification: str = ""
    quantity: float = 0
    unit: str
    unitPrice: float = Field(alias="unitPrice", default=0)
    remarks: str = ""
    aiSuggested: bool = Field(alias="aiSuggested", default=False)

    model_config = {"populate_by_name": True}


class PdfAnalysisResponse(BaseModel):
    items: list[EstimateItemSchema]
    warnings: list[str] = []


class CsvExportRequest(BaseModel):
    name: str = ""
    clientName: str = Field(alias="clientName", default="")
    siteAddress: str = Field(alias="siteAddress", default="")
    items: list[EstimateItemSchema]
    taxRate: float = Field(alias="taxRate", default=0.10)

    model_config = {"populate_by_name": True}
