import httpx
from bs4 import BeautifulSoup
import logging

logging.basicConfig(level=logging.INFO)

MARKET_SOURCES = [
    {
        "name": "DongXanh",
        "url": "https://thucphamdongxanh.com/bang-gia-rau-cu-qua-cho-dau-moi-hom-nay/",
        "selector": "table tr",
        "mapping": {"product": 1, "price": 2}
    }
]

FALLBACK_DATA = [
    {"source": "MarketEstimate", "product": "Cherry Tomato (Grade A)", "price": "55,000 VND/kg", "trend": "up"},
    {"source": "MarketEstimate", "product": "Cucumber", "price": "15,000 VND/kg", "trend": "stable"},
    {"source": "MarketEstimate", "product": "Bell Pepper", "price": "45,000 VND/kg", "trend": "up"},
]

async def crawl_market_prices():
    results = []

    for source in MARKET_SOURCES:
        try:
            async with httpx.AsyncClient(timeout=20, follow_redirects=True) as client:
                response = await client.get(source["url"], headers={
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                })

                if response.status_code == 200:
                    soup = BeautifulSoup(response.text, "html.parser")
                    rows = soup.select(source["selector"])

                    for row in rows:
                        cols = row.find_all("td")
                        p_idx = source["mapping"]["product"]
                        pr_idx = source["mapping"]["price"]
                        
                        if len(cols) > max(p_idx, pr_idx):
                            product_name = cols[p_idx].get_text(strip=True)
                            price = cols[pr_idx].get_text(strip=True)
                            

                            if product_name and price and any(char.isdigit() for char in price):
                                if "tên" not in product_name.lower():
                                    results.append({
                                        "source": source["name"],
                                        "product": product_name,
                                        "price": f"{price} VND/kg",
                                        "trend": "stable"
                                    })
                    
                    if results:
                        logging.info(f"Successfully crawled {len(results)} items from {source['name']}")
                        break # Success

        except Exception as e:
            logging.error(f"Error crawling {source['name']}: {e}")

    if not results:
        logging.warning("No live data crawled, using fallback.")
        return FALLBACK_DATA


    tomato_items = [p for p in results if "cà chua" in p["product"].lower() or "tomato" in p["product"].lower()]
    other_items = [p for p in results if not ("cà chua" in p["product"].lower() or "tomato" in p["product"].lower())]


    final_results = tomato_items + other_items


    if not tomato_items:
        final_results.insert(0, {"source": "MarketEstimate", "product": "Cà chua Cherry (Đà Lạt)", "price": "45,000 VND/kg", "trend": "up"})
        final_results.insert(1, {"source": "MarketEstimate", "product": "Cà chua Beefsteak (Grade A)", "price": "38,000 VND/kg", "trend": "stable"})

    return final_results[:50] # Limit to 50 items for optimal performance while keeping variety

if __name__ == "__main__":
    import asyncio
    data = asyncio.run(crawl_market_prices())
    for item in data:
        print(item)


