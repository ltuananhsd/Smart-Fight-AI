export const FlightCardRenderer = {
  renderCards(flights: any[], maxCards = 10): string {
    if (!flights || flights.length === 0) {
      return '<p style="color:var(--text-muted)">Không tìm thấy chuyến bay nào.</p>';
    }

    const shown = flights.slice(0, maxCards);
    let html = shown.map((f, i) => this.renderCard(f, i + 1)).join("");

    if (flights.length > maxCards) {
      html += `<p style="color:var(--text-muted);font-size:0.85rem;margin-top:var(--space-sm)">
                ...và ${Math.max(0, flights.length - maxCards)} kết quả khác
            </p>`;
    }

    return html;
  },

  renderCard(flight: any, rank = 0): string {
    const isBest = flight.is_best;
    const bestClass = isBest ? "flight-card-best" : "";

    const stops =
      flight.stops === 0
        ? '<span class="flight-badge flight-badge-direct">Direct</span>'
        : `${flight.stops} stop${flight.stops > 1 ? "s" : ""}`;

    const badges = [];
    if (isBest)
      badges.push('<span class="flight-badge flight-badge-best">⭐ Best</span>');
    if (flight.often_delayed)
      badges.push(
        '<span class="flight-badge flight-badge-delayed">⚠️ Often Delayed</span>'
      );
    if (flight.stops === 0)
      badges.push(
        '<span class="flight-badge flight-badge-direct">✈ Direct</span>'
      );

    const depTime = this._formatTime(flight.departure);
    const arrTime = this._formatTime(flight.arrival);
    const duration = this._formatDuration(flight.duration_minutes);
    const price = this._formatPrice(flight.price_total, flight.price_currency);

    return `
        <div class="flight-card ${bestClass}">
            <div class="flight-card-header">
                <div>
                    ${
                      rank
                        ? `<span style="color:var(--text-muted);font-size:0.8rem">#${rank}</span> `
                        : ""
                    }
                    <span class="flight-airline">${flight.airlines.join(
                      ", "
                    )}</span>
                    <span style="color:var(--text-muted);font-size:0.8rem"> ${flight.flight_numbers.join(
                      ", "
                    )}</span>
                </div>
                <div class="flight-price">${price}</div>
            </div>
            <div class="flight-route">
                <div>
                    <div class="flight-time">${depTime}</div>
                    <div class="flight-airport">${flight.origin}</div>
                </div>
                <div class="flight-line">
                    <div class="flight-duration">${duration}</div>
                    <div class="flight-stops">${stops}</div>
                </div>
                <div style="text-align:right">
                    <div class="flight-time">${arrTime}</div>
                    <div class="flight-airport">${flight.destination}</div>
                </div>
            </div>
            <div class="flight-meta">
                ${badges.join(" ")}
                ${flight.airplane ? `<span>🛩 ${flight.airplane}</span>` : ""}
                ${flight.legroom ? `<span>💺 ${flight.legroom}</span>` : ""}
                ${
                  flight.carbon_g
                    ? `<span>🌱 ${(flight.carbon_g / 1000).toFixed(
                        0
                      )}kg CO₂</span>`
                    : ""
                }
            </div>
        </div>`;
  },

  _formatTime(timeStr: string) {
    if (!timeStr) return "--:--";
    const parts = timeStr.split(" ");
    return parts.length >= 2
      ? parts[1].substring(0, 5)
      : timeStr.substring(0, 5);
  },

  _formatDuration(minutes: number) {
    if (!minutes || minutes <= 0) return "N/A";
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  },

  _formatPrice(amount: number, currency = "USD") {
    if (!amount) return "N/A";
    const symbol = currency === "VND" ? "₫" : "$";
    return `${symbol}${amount.toLocaleString()}`;
  },
};
