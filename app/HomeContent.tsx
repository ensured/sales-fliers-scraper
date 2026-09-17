"use client";

import { useState, useEffect } from "react";
import FlyerCard from "@/components/FlyerCard";
import ImageFlyerCard from "@/components/ImageFlyerCard";
import { ThemeToggle } from "@/components/theme-toggle";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";
import ShoppingList from "@/app/components/ShoppingList";

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

type StoreKey = "food-coop" | "shop-n-kart" | "market-of-choice";

const FLYER_CACHE_TTL_MS = 4 * 60 * 60 * 1000;
const flyerCache = new Map<StoreKey, { savedAt: number; data: ScrapeResult }>();

export default function HomeContent() {
  const [activeStoreTab, setActiveStoreTab] = useState("ashland-food-coop");
  const [isLoadingFlyers, setIsLoadingFlyers] = useState(false);
  const [foodCoopResult, setFoodCoopResult] = useState<ScrapeResult | null>(
    null,
  );
  const [shopNKartResult, setShopNKartResult] = useState<ScrapeResult | null>(
    null,
  );
  const [marketOfChoiceResult, setMarketOfChoiceResult] =
    useState<ScrapeResult | null>(null);
  const [lastUpdatedLabel, setLastUpdatedLabel] = useState<string | null>(null);
  const [refreshCountdown, setRefreshCountdown] = useState<string | null>(null);

  const getCacheKey = (store: StoreKey) => `flyers-cache:${store}`;

  const getCachedResult = (store: StoreKey) => {
    const memoryCached = flyerCache.get(store);
    if (
      memoryCached &&
      Date.now() - memoryCached.savedAt <= FLYER_CACHE_TTL_MS
    ) {
      return memoryCached.data;
    }

    if (memoryCached) {
      flyerCache.delete(store);
    }

    if (typeof window === "undefined") {
      return null;
    }

    try {
      const cachedItem = window.localStorage.getItem(getCacheKey(store));
      if (!cachedItem) {
        return null;
      }

      const parsed = JSON.parse(cachedItem) as {
        savedAt: number;
        data: ScrapeResult;
      };

      if (Date.now() - parsed.savedAt > FLYER_CACHE_TTL_MS) {
        window.localStorage.removeItem(getCacheKey(store));
        return null;
      }

      flyerCache.set(store, { savedAt: parsed.savedAt, data: parsed.data });
      return parsed.data;
    } catch {
      return null;
    }
  };

  const setCachedResult = (store: StoreKey, result: ScrapeResult) => {
    const cacheEntry = { savedAt: Date.now(), data: result };
    flyerCache.set(store, cacheEntry);

    if (typeof window === "undefined") {
      return;
    }

    try {
      window.localStorage.setItem(
        getCacheKey(store),
        JSON.stringify(cacheEntry),
      );
    } catch {
      // Ignore storage failures so the app can keep working.
    }
  };

  const applyStoreResult = (store: StoreKey, result: ScrapeResult | null) => {
    if (store === "food-coop") {
      setFoodCoopResult(result);
    } else if (store === "shop-n-kart") {
      setShopNKartResult(result);
    } else {
      setMarketOfChoiceResult(result);
    }
  };

  const formatLastUpdated = (timestamp?: string) => {
    if (!timestamp) {
      return null;
    }

    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) {
      return null;
    }

    return `Last updated ${date.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    })}`;
  };

  const formatRefreshCountdown = (timestamp?: string) => {
    if (!timestamp) {
      return null;
    }

    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) {
      return null;
    }

    const expiresAt = date.getTime() + FLYER_CACHE_TTL_MS;
    const remainingMs = expiresAt - Date.now();

    if (remainingMs <= 0) {
      return "Refresh available now";
    }

    const remainingHours = Math.floor(remainingMs / (1000 * 60 * 60));
    const remainingMinutes = Math.floor(
      (remainingMs % (1000 * 60 * 60)) / (1000 * 60),
    );

    if (remainingHours > 0) {
      return `${remainingHours}h ${remainingMinutes}m until refresh`;
    }

    return `${remainingMinutes}m until refresh`;
  };

  // A successful flyer result is "fresh" until its recorded server timestamp
  // is older than the TTL. Error results are never fresh so they get retried.
  const isResultFresh = (result: ScrapeResult | null) => {
    if (!result?.success || !result.timestamp) {
      return false;
    }
    const fetchedAt = new Date(result.timestamp).getTime();
    if (Number.isNaN(fetchedAt)) {
      return false;
    }
    return Date.now() - fetchedAt <= FLYER_CACHE_TTL_MS;
  };

  const loadStoreFlyers = async (store: StoreKey) => {
    const currentResult =
      store === "food-coop"
        ? foodCoopResult
        : store === "shop-n-kart"
          ? shopNKartResult
          : marketOfChoiceResult;

    // Fresh in-memory result: nothing to do.
    if (currentResult && isResultFresh(currentResult)) {
      applyStoreResult(store, currentResult);
      setLastUpdatedLabel(formatLastUpdated(currentResult.timestamp));
      setRefreshCountdown(formatRefreshCountdown(currentResult.timestamp));
      return;
    }

    setIsLoadingFlyers(true);

    // A stale/missing result is re-fetched from the server, so flyer updates
    // show up instead of serving the same cached copy forever. Fall back to
    // localStorage only when we have nothing at all in memory.
    if (!currentResult) {
      const cachedResult = getCachedResult(store);
      if (cachedResult) {
        applyStoreResult(store, cachedResult);
        setLastUpdatedLabel(formatLastUpdated(cachedResult.timestamp));
        setRefreshCountdown(formatRefreshCountdown(cachedResult.timestamp));
        setIsLoadingFlyers(false);
        return;
      }
    }

    try {
      let result: ScrapeResult;

      if (store === "food-coop") {
        const response = await fetch("/api/scrape/ashland-coop", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
        result = await response.json();
      } else if (store === "shop-n-kart") {
        const response = await fetch(
          `/api/scrape/shop-n-kart?t=${Date.now()}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            cache: "no-store",
          },
        );
        result = await response.json();
      } else {
        const response = await fetch(
          `/api/scrape/market-of-choice?t=${Date.now()}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            cache: "no-store",
          },
        );
        result = await response.json();
      }

      applyStoreResult(store, result);
      setLastUpdatedLabel(formatLastUpdated(result.timestamp));
      setRefreshCountdown(formatRefreshCountdown(result.timestamp));

      if (result.success) {
        setCachedResult(store, result);
      }
    } catch (error) {
      // Keep showing the last known flyer if a re-fetch fails - only replace
      // it with an error screen when we have nothing to show at all.
      if (!currentResult) {
        const fallbackError: ScrapeResult = {
          success: false,
          message: "Failed to connect",
          timestamp: new Date().toISOString(),
          error: error instanceof Error ? error.message : "Unknown error",
        };

        applyStoreResult(store, fallbackError);
        setLastUpdatedLabel(formatLastUpdated(fallbackError.timestamp));
        setRefreshCountdown(formatRefreshCountdown(fallbackError.timestamp));
      }
    } finally {
      setIsLoadingFlyers(false);
    }
  };

  // Auto-load all stores on mount
  useEffect(() => {
    const loadAll = async () => {
      setIsLoadingFlyers(true);
      try {
        const [foodCoopResponse, shopNKartResponse, marketOfChoiceResponse] =
          await Promise.all([
            fetch("/api/scrape/ashland-coop", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
            }),
            fetch(`/api/scrape/shop-n-kart?t=${Date.now()}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              cache: "no-store",
            }),
            fetch(`/api/scrape/market-of-choice?t=${Date.now()}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              cache: "no-store",
            }),
          ]);

        const [foodCoopData, shopNKartData, marketOfChoiceData] =
          await Promise.all([
            foodCoopResponse.json(),
            shopNKartResponse.json(),
            marketOfChoiceResponse.json(),
          ]);

        applyStoreResult("food-coop", foodCoopData);
        applyStoreResult("shop-n-kart", shopNKartData);
        applyStoreResult("market-of-choice", marketOfChoiceData);

        if (foodCoopData.success) setCachedResult("food-coop", foodCoopData);
        if (shopNKartData.success)
          setCachedResult("shop-n-kart", shopNKartData);
        if (marketOfChoiceData.success)
          setCachedResult("market-of-choice", marketOfChoiceData);

        setLastUpdatedLabel(formatLastUpdated(foodCoopData.timestamp));
        setRefreshCountdown(formatRefreshCountdown(foodCoopData.timestamp));
      } catch (error) {
        const fallbackError: ScrapeResult = {
          success: false,
          message: "Failed to connect",
          timestamp: new Date().toISOString(),
          error: error instanceof Error ? error.message : "Unknown error",
        };

        applyStoreResult("food-coop", fallbackError);
        applyStoreResult("shop-n-kart", fallbackError);
        applyStoreResult("market-of-choice", fallbackError);
        setLastUpdatedLabel(formatLastUpdated(fallbackError.timestamp));
        setRefreshCountdown(formatRefreshCountdown(fallbackError.timestamp));
      } finally {
        setIsLoadingFlyers(false);
      }
    };

    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onPdfError(error: Error): void {
    console.error("PDF rendering error:", error);
  }

  return (
    <div className="min-h-screen py-8 px-3 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <header className="flex justify-between items-center mb-8">
          <div className="flex-1">
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
              Grocery Deals/List
            </h1>
            <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed max-w-lg">
              Deals &amp; shopping list, together.
            </p>
          </div>
          <div className="ml-4 shrink-0">
            <ThemeToggle />
          </div>
        </header>

        {/* Page Tabs: Deals / Shopping List */}
        <Tabs defaultValue="deals" className="flex flex-col">
          <TabsList className="w-fit mb-6">
            <TabsTrigger value="deals" className="flex items-center gap-1.5">
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
              Find Deals
            </TabsTrigger>
            <TabsTrigger value="list" className="flex items-center gap-1.5">
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <path d="M16 10a4 4 0 0 1-8 0" />
              </svg>
              Shopping List
            </TabsTrigger>
          </TabsList>

          <TabsContent value="deals" className="mt-0">
            <section>
              <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
                {/* Header bar */}
                <div className="border-b border-border/60 px-5 py-4 flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold tracking-tight text-card-foreground">
                      Available Flyers by Store
                    </h2>
                    {isLoadingFlyers && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Loading flyers...
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-0.5 text-right shrink-0">
                    {lastUpdatedLabel && (
                      <span className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wider">
                        {lastUpdatedLabel}
                      </span>
                    )}
                    {refreshCountdown && (
                      <span className="text-[11px] text-muted-foreground/50">
                        {refreshCountdown}
                      </span>
                    )}
                  </div>
                </div>

                <Tabs
                  value={activeStoreTab}
                  onValueChange={(value) => {
                    setActiveStoreTab(value);
                    if (value === "ashland-food-coop") {
                      void loadStoreFlyers("food-coop");
                    } else if (value === "shop-n-kart") {
                      void loadStoreFlyers("shop-n-kart");
                    } else {
                      void loadStoreFlyers("market-of-choice");
                    }
                  }}
                  className="flex flex-col"
                >
                  <div className="px-5 pt-5">
                    <TabsList className="w-fit">
                      <TabsTrigger value="ashland-food-coop">
                        Ashland Food Coop
                      </TabsTrigger>
                      <TabsTrigger value="shop-n-kart">Shop N Kart</TabsTrigger>
                      <TabsTrigger value="market-of-choice">
                        Market of Choice
                      </TabsTrigger>
                    </TabsList>
                  </div>

                  <div className="p-5">
                    <TabsContent
                      value="ashland-food-coop"
                      className="mt-0 space-y-4"
                    >
                      {isLoadingFlyers && !foodCoopResult ? (
                        <div className="flex items-center justify-center rounded-lg border border-dashed border-border p-8 text-sm text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Loading Ashland Food Coop flyers...
                          </div>
                        </div>
                      ) : foodCoopResult?.error ? (
                        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
                          {foodCoopResult.error}
                        </div>
                      ) : foodCoopResult?.pdfData ||
                        foodCoopResult?.nationalCoopPdfData ? (
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
                              pdfFileName={
                                foodCoopResult.nationalCoopPdfFileName
                              }
                              url={foodCoopResult.nationalCoopLink}
                              onPdfError={onPdfError}
                            />
                          )}
                        </div>
                      ) : (
                        <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                          No flyers are available yet for this store.
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="shop-n-kart" className="mt-0 space-y-4">
                      {isLoadingFlyers && !shopNKartResult ? (
                        <div className="flex items-center justify-center rounded-lg border border-dashed border-border p-8 text-sm text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Loading Shop N Kart flyers...
                          </div>
                        </div>
                      ) : shopNKartResult?.error ? (
                        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
                          {shopNKartResult.error}
                        </div>
                      ) : shopNKartResult?.flyerData ||
                        shopNKartResult?.ionFlyerData ? (
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
                      ) : (
                        <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                          No flyers are available yet for this store.
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent
                      value="market-of-choice"
                      className="mt-0 space-y-4"
                    >
                      {isLoadingFlyers && !marketOfChoiceResult ? (
                        <div className="flex items-center justify-center rounded-lg border border-dashed border-border p-8 text-sm text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Loading Market of Choice flyers...
                          </div>
                        </div>
                      ) : marketOfChoiceResult?.error ? (
                        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
                          {marketOfChoiceResult.error}
                        </div>
                      ) : marketOfChoiceResult?.pdfData ? (
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                          <FlyerCard
                            title="Market of Choice"
                            description="Weekly deals and specials"
                            pdfData={marketOfChoiceResult.pdfData}
                            pdfFileName={marketOfChoiceResult.pdfFileName}
                            dateRange={
                              marketOfChoiceResult.dateRange || "Current Week"
                            }
                            url="https://marketofchoice.com/specials/weekly/"
                            onPdfError={onPdfError}
                          />
                        </div>
                      ) : (
                        <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                          No flyers are available yet for this store.
                        </div>
                      )}
                    </TabsContent>
                  </div>
                </Tabs>
              </div>
            </section>
          </TabsContent>

          <TabsContent value="list" className="mt-0">
            <ShoppingList />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
