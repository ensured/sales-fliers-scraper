"use client";

import { useState, useEffect } from "react";
import PDFViewer from "./components/PDFViewer";
import FlyerCard from "@/components/FlyerCard";
import ImageFlyerCard from "@/components/ImageFlyerCard";
import { ThemeToggle } from "@/components/theme-toggle";
import Link from "next/link";

interface ScrapeResult {
  success: boolean;
  message: string;
  timestamp: string;
  screenshot?: string;
  error?: string;
  pdfData?: string;
  pdfFileName?: string;
  nationalCoopPdfData?: string;
  nationalCoopPdfFileName?: string;
  nationalCoopLink?: string;
  mainFlyerLink?: string;
  // Shop N Kart specific fields
  flyerData?: string;
  flyerFileName?: string;
  flyerUrl?: string;
  dateRange?: string;
  // Ion flyer fields (from consolidated API)
  ionFlyerData?: string;
  ionFileName?: string;
  ionUrl?: string;
  ionDateRange?: string;
}

export default function HomeContent() {
  const [foodCoopLoading, setFoodCoopLoading] = useState(false);
  const [shopNKartLoading, setShopNKartLoading] = useState(false);
  const [marketOfChoiceLoading, setMarketOfChoiceLoading] = useState(false);
  const [foodCoopResult, setFoodCoopResult] = useState<ScrapeResult | null>(
    null
  );
  const [shopNKartResult, setShopNKartResult] = useState<ScrapeResult | null>(
    null
  );
  const [marketOfChoiceResult, setMarketOfChoiceResult] = useState<ScrapeResult | null>(
    null
  );
  const [albertsonsLoading, setAlbertsonsLoading] = useState(false);
  const [albertsonsResult, setAlbertsonsResult] = useState<{
    success: boolean;
    flyers?: Array<{ title: string; dateRange: string; imageUrl: string }>;
    error?: string;
  } | null>(null);

  const scrapeAshlandFoodCoop = async () => {
    setFoodCoopLoading(true);
    setFoodCoopResult(null);

    try {
      const response = await fetch("/api/scrape/ashland-coop", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();
      setFoodCoopResult(data);
    } catch (error) {
      setFoodCoopResult({
        success: false,
        message: "Failed to connect to scraper",
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setFoodCoopLoading(false);
    }
  };

  const scrapeAshlandShopNKart = async () => {
    setShopNKartLoading(true);
    setShopNKartResult(null);

    try {
      console.log("Fetching Shop N Kart flyers (consolidated)...");
      // Single API call now returns both Shop N Kart AND Ion flyers
      const response = await fetch(`/api/scrape/shop-n-kart?t=${Date.now()}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        cache: "no-store",
      });

      const data = await response.json();
      console.log("Flyers fetched - Shop N Kart cached:", data.shopNKartCached, "| Ion cached:", data.ionCached);
      setShopNKartResult(data);
    } catch (error) {
      setShopNKartResult({
        success: false,
        message: "Failed to connect to scraper",
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setShopNKartLoading(false);
    }
  };

  const scrapeMarketOfChoice = async () => {
    setMarketOfChoiceLoading(true);
    setMarketOfChoiceResult(null);

    try {
      console.log("Fetching Market of Choice flyer...");
      const response = await fetch(`/api/scrape/market-of-choice?t=${Date.now()}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        cache: "no-store",
      });

      const data = await response.json();
      console.log("Market of Choice flyer fetched - cached:", data.cached);
      setMarketOfChoiceResult(data);
    } catch (error) {
      setMarketOfChoiceResult({
        success: false,
        message: "Failed to connect to scraper",
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setMarketOfChoiceLoading(false);
    }
  };

  function onPdfError(error: Error): void {
    console.error("PDF rendering error:", error);
  }



  return (
    <div className="min-h-screen py-4 px-2 sm:px-4 lg:px-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-4">
          <div className="text-center flex-1">
            <h1 className="text-2xl font-bold ">
              Sales Flyers Scraper
            </h1>
            <p className="text-sm ">
              Automatically scrape sales flyers from multiple websites
            </p>
          </div>
          <div className="ml-4">
            <ThemeToggle />
          </div>
        </div>

        <div className="space-y-3">
          {/* Ashland Food Coop Section */}
          <div className="bg-card shadow-lg rounded-lg p-4 border border-border">
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-white p-1 rounded">
                <img
                  src="https://www.google.com/s2/favicons?domain=ashlandfood.coop&sz=32"
                  alt="Ashland Food Coop logo"
                  className="w-6 h-6"
                />
              </div>
              <h2 className="text-lg font-semibold text-card-foreground">
                Ashland Food Coop
              </h2>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              Click the button below to scrape the latest sales flyer from
              Ashland Food Coop
            </p>

            <button
              onClick={scrapeAshlandFoodCoop}
              disabled={foodCoopLoading}
              className="w-full sm:w-auto px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-md hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed transition-colors"
            >
              {foodCoopLoading
                ? "Scraping..."
                : "Ashland Food Coop"}
            </button>

            {foodCoopResult && (
              <div
                className={`mt-3 p-3 rounded-md text-sm border ${foodCoopResult.success
                  ? "bg-muted border-border"
                  : "bg-destructive/10 border-destructive/50"
                  }`}
              >
                {/* <h3
                  className={`text-lg font-medium ${
                    foodCoopResult.success
                      ? "text-green-800 dark:text-green-100"
                      : "text-red-800 dark:text-red-100"
                  }`}
                >
                  {foodCoopResult.success ? "Success!" : "Error"}
                </h3> */}
                {/* <p
                  className={`mt-2 text-sm ${
                    foodCoopResult.success
                      ? "text-green-700 dark:text-green-300"
                      : "text-red-700 dark:text-red-300"
                  }`}
                >
                  {foodCoopResult.message}
                </p> */}

                {foodCoopResult.error && (
                  <p className="mt-2 text-sm text-destructive">
                    Error details: {foodCoopResult.error}
                  </p>
                )}
                {(foodCoopResult.pdfData ||
                  foodCoopResult.nationalCoopPdfData) && (
                    <div className="mt-2">
                      <h3 className="text-xl font-bold text-foreground mb-6">
                        Available Flyers
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {foodCoopResult.pdfData && (
                          <FlyerCard
                            title="Ashland Food Coop Flyer"
                            description="Main weekly sales flyer from Ashland Food Coop"
                            pdfData={foodCoopResult.pdfData}
                            pdfFileName={foodCoopResult.pdfFileName}
                            url={foodCoopResult.mainFlyerLink}
                            onPdfError={onPdfError}
                          />
                        )}
                        {foodCoopResult.nationalCoopPdfData && (
                          <FlyerCard
                            title="National Co-op Grocers"
                            description="National co-op deals and special offers"
                            pdfData={foodCoopResult.nationalCoopPdfData}
                            pdfFileName={foodCoopResult.nationalCoopPdfFileName}
                            url={foodCoopResult.nationalCoopLink}
                            onPdfError={onPdfError}
                          />
                        )}
                      </div>
                    </div>
                  )}
                {foodCoopResult.mainFlyerLink && (
                  <div className="mt-4">
                    <p className="text-sm text-muted-foreground mb-2">
                      Main flyer link:
                    </p>
                    <a
                      href={foodCoopResult.mainFlyerLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:text-primary/80 underline break-all"
                    >
                      {foodCoopResult.mainFlyerLink}
                    </a>
                  </div>
                )}
                {foodCoopResult.nationalCoopLink && (
                  <div className="mt-4">
                    <p className="text-sm text-muted-foreground mb-2">
                      National Co-op Grocers link:
                    </p>
                    <a
                      href={foodCoopResult.nationalCoopLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:text-primary/80 underline break-all"
                    >
                      {foodCoopResult.nationalCoopLink}
                    </a>
                  </div>
                )}
                {foodCoopResult.screenshot && !foodCoopResult.pdfData && (
                  <div className="mt-4">
                    <p className="text-sm text-muted-foreground mb-2">
                      Screenshot proof:
                    </p>
                    <img
                      src={foodCoopResult.screenshot}
                      alt="Scraping screenshot"
                      className="max-w-full h-auto border border-border rounded"
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Ashland Shop N Kart Section */}
          <div className="bg-card shadow-lg rounded-lg p-4 border border-border">
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-white p-1 rounded">
                <img
                  src="https://www.google.com/s2/favicons?domain=ashlandshopnkart.com&sz=32"
                  alt="Shop N Kart logo"
                  className="w-6 h-6"
                />
              </div>
              <h2 className="text-lg font-semibold text-card-foreground">
                Ashland Shop N Kart
              </h2>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              Click the button below to scrape the latest sales flyers from
              Ashland Shop N Kart
            </p>

            <button
              onClick={scrapeAshlandShopNKart}
              disabled={shopNKartLoading}
              className="w-full sm:w-auto px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-md hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed transition-colors"
            >
              {shopNKartLoading ? "Scraping..." : "Shop N Kart"}
            </button>

            {/* Only show Available Flyers section after scraping */}
            {(shopNKartResult?.flyerData || shopNKartResult?.ionFlyerData) && (
              <div className="mt-3">
                <h3 className="text-lg font-bold text-foreground mb-3">
                  Available Flyers
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {shopNKartResult.flyerData && (
                    <ImageFlyerCard
                      title="Shop N Kart Flyer"
                      description="Shop N Kart weekly deals and special offers"
                      imageData={shopNKartResult.flyerData}
                      imageFileName={shopNKartResult.flyerFileName}
                      url={shopNKartResult.flyerUrl}
                      dateRange={shopNKartResult.dateRange}
                    />
                  )}
                  {shopNKartResult.ionFlyerData && (
                    <ImageFlyerCard
                      title="Ion Flyer"
                      description="Ion deals and special offers"
                      imageData={shopNKartResult.ionFlyerData}
                      imageFileName={shopNKartResult.ionFileName}
                      url={shopNKartResult.ionUrl}
                      dateRange={shopNKartResult.ionDateRange}
                    />
                  )}
                </div>
              </div>
            )}

          </div>

          {/* Market of Choice Section */}
          <div className="bg-card shadow-lg rounded-lg p-4 border border-border">
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-white p-1 rounded">
                <img
                  src="https://www.google.com/s2/favicons?domain=marketofchoice.com&sz=32"
                  alt="Market of Choice logo"
                  className="w-6 h-6"
                />
              </div>
              <h2 className="text-lg font-semibold text-card-foreground">
                Market of Choice
              </h2>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              Click the button below to scrape the latest weekly sales flyer from
              Market of Choice
            </p>

            <button
              onClick={scrapeMarketOfChoice}
              disabled={marketOfChoiceLoading}
              className="w-full sm:w-auto px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-md hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed transition-colors"
            >
              {marketOfChoiceLoading ? "Scraping..." : "Market of Choice"}
            </button>

            {marketOfChoiceResult && (
              <div
                className={`mt-3 p-3 rounded-md text-sm border ${marketOfChoiceResult.success
                  ? "bg-muted border-border"
                  : "bg-destructive/10 border-destructive/50"
                  }`}
              >
                {marketOfChoiceResult.error && (
                  <p className="mt-2 text-sm text-destructive">
                    Error details: {marketOfChoiceResult.error}
                  </p>
                )}
                {marketOfChoiceResult.pdfData && (
                  <div className="mt-2">
                    <h3 className="text-xl font-bold text-foreground mb-6">
                      Available Flyers
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FlyerCard
                        title="Market of Choice Weekly"
                        description={`Weekly deals and specials (${marketOfChoiceResult.dateRange || 'Current Week'})`}
                        pdfData={marketOfChoiceResult.pdfData}
                        pdfFileName={marketOfChoiceResult.pdfFileName}
                        url="https://marketofchoice.com/specials/weekly/"
                        onPdfError={onPdfError}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Albertsons Section */}
          <div className="bg-card shadow-lg rounded-lg p-4 border border-border">
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-white p-1 rounded">
                <img
                  src="https://www.google.com/s2/favicons?domain=albertsons.com&sz=32"
                  alt="Albertsons logo"
                  className="w-6 h-6"
                />
              </div>
              <h2 className="text-lg font-semibold text-card-foreground">
                Albertsons
              </h2>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              Click the button to load available weekly ads
            </p>

            <Link target="_blank" href="https://www.albertsons.com/weeklyad" className="w-full sm:w-auto px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-md hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed transition-colors">
              Albertsons
            </Link>

            {albertsonsResult?.error && (
              <p className="mt-2 text-sm text-destructive">
                Error: {albertsonsResult.error}
              </p>
            )}

            {albertsonsResult?.flyers && albertsonsResult.flyers.length > 0 && (
              <div className="mt-3">
                <h3 className="text-lg font-bold mb-3">
                  Available Weekly Ads
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {albertsonsResult.flyers.map((flyer, index) => (
                    <a
                      key={index}
                      href="https://www.albertsons.com/weeklyad/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block p-3 bg-white rounded-lg border hover:shadow-md transition-shadow"
                    >
                      {flyer.imageUrl && (
                        <img
                          src={flyer.imageUrl}
                          alt={flyer.title}
                          className="w-full h-24 object-cover rounded mb-2"
                        />
                      )}
                      <p className="font-medium text-sm text-gray-900">{flyer.title}</p>
                      <p className="text-xs text-gray-500">{flyer.dateRange}</p>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
