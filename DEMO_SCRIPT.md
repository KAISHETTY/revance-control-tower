# Two-minute phone demo

Setup: open the deployed URL on your phone before you sit down, and leave it on the network view at 1x speed. Turn on Do Not Disturb. Backup: `docs/demo.webm` (download it to your phone beforehand).

## 0:00 to 0:15, the opener (lead with the problem, not the code)

> "Most cold-chain problems are invisible until they cost you: a reefer sitting at a dock in the heat, a lot that expires on the shelf, an order that shipped but never got billed. Those live in four different systems. I wanted to see what it looks like when they're on one screen."

Then: "Everything you'll see is synthetic, made up. It isn't connected to anything of yours."

## 0:15 to 0:35, network view

- Hold the phone so they can see the three sites. Point at the headline sentence at the top: it is computed from the data (cold-chain alerts, expiring lots, orders with problems, dollars at risk).
- "Each island is a site. The ring is its health. The trucks are moving between them in simulated time."
- Optional: swipe with one finger to orbit and show that it's live 3D.

## 0:35 to 1:00, a reefer with a temperature excursion

- Tap the top alert: **Reefer TRK-113 excursion**. The camera flies to the West Coast dock.
- Read the explanation out loud: "likely at the dock with doors open too long in a 31°C yard… possibly compromised."
- Point at the box temperature and the shipment on board, which lists the customer, the products and the lot numbers.
- "So this connects a sensor reading to the exact lots and customer it affects."

## 1:00 to 1:20, an expiring lot

- Tap the **Lots** tab, then the first lot marked "≤ 30 days". The camera flies to its bay, and the pallets are colored by expiry.
- "Orange is under 30 days, red is expired and still in a pickable bay. That's a write-off, or worse, a shipment."

## 1:20 to 1:45, an order-to-cash exception

- Tap the **Orders** tab. "This is a three-way match: order against shipment against invoice."
- Tap the top row. The drawer shows ordered, shipped and invoiced side by side, with the mismatch highlighted in red, the dollar impact and a next step.
- If there's time, filter **Type → Price mismatch** or **Shipped, not invoiced**, and mention Export CSV.

## 1:45 to 2:00, close with questions (then stop talking)

1. "Where would this break in your real setup?"
2. "Which of these alerts would hurt most today?"
3. "What would you need to see before trusting something like this?"

## If something goes wrong

- **3D is slow or blank:** tap the layers icon in the top bar to switch to the 2D map. Everything works the same.
- **Lost the view:** tap **Reset view**.
- **Want a different scenario:** the circular-arrows icon regenerates the world from a new seed.
- **Phone is struggling:** on a laptop, the sparkles icon turns on low graphics.
- **No network:** play `docs/demo.webm`.
