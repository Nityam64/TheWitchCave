import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

// ============================================================================
// HEXLEY'S POTION PANTRY — BALANCED VICTORIAN APOTHECARY DESIGN SYSTEM
// ============================================================================
const Color kNight = Color(0xFF140A1D);      // Deep midnight page background
const Color kPanel = Color(0xFF22132E);      // Dark violet apothecary panel
const Color kCard = Color(0xFF1C1126);       // Card background
const Color kParchment = Color(0xFFECDCCC);  // Antique paper cream
const Color kInk = Color(0xFF2B1D14);        // Text on paper
const Color kPumpkin = Color(0xFFFF7518);    // Signature pumpkin copper
const Color kPumpkinDim = Color(0xFF8B3C08); // Subtle copper border
const Color kGold = Color(0xFFF2B25C);       // Antique potion gold
const Color kSlime = Color(0xFF7FFF5A);      // Poison / Emerald glow
const Color kViolet = Color(0xFF8A4FD1);     // Witch violet
const Color kCrimson = Color(0xFF9B1C1C);    // Urgent shortage crimson
const Color kCrimsonBg = Color(0xFF2A0C14);  // Critical card backdrop
const Color kBorderSubtle = Color(0xFF362247);
const Color kBorderCard = Color(0xFF452B59);

void main() => runApp(const HexleyPantryApp());

class HexleyPantryApp extends StatelessWidget {
  const HexleyPantryApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: "Hexley's Potion Pantry",
      debugShowCheckedModeBanner: false,
      theme: ThemeData.dark().copyWith(
        scaffoldBackgroundColor: kNight,
        cardColor: kCard,
        canvasColor: kNight,
        dialogBackgroundColor: kPanel,
        colorScheme: const ColorScheme.dark(
          primary: kPumpkin,
          secondary: kGold,
          surface: kPanel,
          background: kNight,
          error: kCrimson,
        ),
        appBarTheme: const AppBarTheme(
          backgroundColor: kPanel,
          elevation: 0,
        ),
      ),
      home: const PantryMasterScreen(),
    );
  }
}

class PantryMasterScreen extends StatefulWidget {
  const PantryMasterScreen({super.key});

  @override
  State<PantryMasterScreen> createState() => _PantryMasterScreenState();
}

class _PantryMasterScreenState extends State<PantryMasterScreen> {
  static const String detectedLanIp = "192.168.88.35";
  String serverBaseUrl = "http://192.168.88.35:8000";

  int currentTab = 0; // 0: Dashboard, 1: Inventory, 2: Forecast, 3: Record Sale
  List pantry = [];
  bool isLoading = false;
  bool isConnected = false;
  String connectionMessage = "Connecting...";

  // Inventory Filter State
  String searchQuery = "";
  String activeCategoryFilter = "all";

  // Quick Restock Stepper State: itemId -> qty
  final Map<dynamic, int> restockQuantities = {};

  // Record Sale State
  dynamic selectedSaleItemId;
  int saleQuantity = 1;

  // Forecast Selected Item
  dynamic selectedForecastItemId;

  @override
  void initState() {
    super.initState();
    testAndFetchPantry();
  }

  Future<void> testAndFetchPantry() async {
    setState(() => isLoading = true);
    try {
      final sanitizedBase = serverBaseUrl.trim().replaceAll(RegExp(r'/+$'), '');
      final res = await http
          .get(Uri.parse("$sanitizedBase/api/pantry"))
          .timeout(const Duration(seconds: 4));

      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);
        setState(() {
          pantry = data['pantry'] ?? [];
          isConnected = true;
          connectionMessage = "Vault Synchronized";
          isLoading = false;

          if (pantry.isNotEmpty) {
            if (selectedSaleItemId == null || !pantry.any((i) => i['id'] == selectedSaleItemId)) {
              selectedSaleItemId = pantry.first['id'];
            }
            if (selectedForecastItemId == null || !pantry.any((i) => i['id'] == selectedForecastItemId)) {
              selectedForecastItemId = pantry.first['id'];
            }
            for (var item in pantry) {
              final id = item['id'];
              if (!restockQuantities.containsKey(id)) {
                restockQuantities[id] = 20;
              }
            }
          }
        });
      } else {
        setState(() {
          isConnected = false;
          connectionMessage = "HTTP ${res.statusCode}";
          isLoading = false;
        });
      }
    } catch (e) {
      setState(() {
        isConnected = false;
        connectionMessage = "Offline";
        isLoading = false;
      });
    }
  }

  Future<void> adjustStock(dynamic itemId, int changeAmount, {String? successMsg}) async {
    try {
      final sanitizedBase = serverBaseUrl.trim().replaceAll(RegExp(r'/+$'), '');
      final res = await http.post(
        Uri.parse("$sanitizedBase/api/pantry/$itemId/transaction"),
        headers: {"Content-Type": "application/json"},
        body: jsonEncode({"change_amount": changeAmount}),
      );

      if (res.statusCode == 200) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(successMsg ?? (changeAmount > 0 ? "✨ Restocked +$changeAmount units" : "✦ Recorded sale")),
            backgroundColor: changeAmount > 0 ? const Color(0xFF2E6A45) : kViolet,
            duration: const Duration(seconds: 2),
          ),
        );
        await testAndFetchPantry();
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text("Action failed: $e")),
      );
    }
  }

  Future<void> reportMissingStock(dynamic itemId) async {
    try {
      final sanitizedBase = serverBaseUrl.trim().replaceAll(RegExp(r'/+$'), '');
      await http.post(
        Uri.parse("$sanitizedBase/api/pantry/$itemId/audit"),
        headers: {"Content-Type": "application/json"},
        body: jsonEncode({"missing_amount": 5}),
      );
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text("🚨 Shelf audit reported: 5 units missing recorded"),
          backgroundColor: kCrimson,
          duration: Duration(seconds: 2),
        ),
      );
      await testAndFetchPantry();
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text("Failed to report audit: $e")),
      );
    }
  }

  void openAddIngredientDialog() {
    final nameCtrl = TextEditingController();
    final stockCtrl = TextEditingController(text: "50");
    final safetyCtrl = TextEditingController(text: "15");
    final supplierCtrl = TextEditingController(text: "Diagon Alley Apothecary");
    final leadTimeCtrl = TextEditingController(text: "3");

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: kPanel,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(14),
          side: const BorderSide(color: kPumpkin, width: 1.2),
        ),
        title: Row(
          children: const [
            Text("✦ ", style: TextStyle(color: kPumpkin, fontSize: 18)),
            Text(
              "Register New Reagent",
              style: TextStyle(fontFamily: 'serif', fontSize: 17, fontWeight: FontWeight.bold, color: kParchment),
            ),
          ],
        ),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: nameCtrl,
                style: const TextStyle(color: kParchment, fontSize: 13),
                decoration: const InputDecoration(
                  labelText: "Ingredient Name",
                  labelStyle: TextStyle(color: kGold, fontSize: 12),
                  hintText: "e.g. Phoenix Feather",
                  enabledBorder: OutlineInputBorder(borderSide: BorderSide(color: kBorderSubtle)),
                  focusedBorder: OutlineInputBorder(borderSide: BorderSide(color: kPumpkin)),
                  isDense: true,
                ),
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: stockCtrl,
                      keyboardType: TextInputType.number,
                      style: const TextStyle(color: kParchment, fontSize: 13),
                      decoration: const InputDecoration(
                        labelText: "Current Stock",
                        labelStyle: TextStyle(color: kGold, fontSize: 11),
                        enabledBorder: OutlineInputBorder(borderSide: BorderSide(color: kBorderSubtle)),
                        focusedBorder: OutlineInputBorder(borderSide: BorderSide(color: kPumpkin)),
                        isDense: true,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: TextField(
                      controller: safetyCtrl,
                      keyboardType: TextInputType.number,
                      style: const TextStyle(color: kParchment, fontSize: 13),
                      decoration: const InputDecoration(
                        labelText: "Safety Threshold",
                        labelStyle: TextStyle(color: kGold, fontSize: 11),
                        enabledBorder: OutlineInputBorder(borderSide: BorderSide(color: kBorderSubtle)),
                        focusedBorder: OutlineInputBorder(borderSide: BorderSide(color: kPumpkin)),
                        isDense: true,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              TextField(
                controller: supplierCtrl,
                style: const TextStyle(color: kParchment, fontSize: 13),
                decoration: const InputDecoration(
                  labelText: "Supplier",
                  labelStyle: TextStyle(color: kGold, fontSize: 12),
                  enabledBorder: OutlineInputBorder(borderSide: BorderSide(color: kBorderSubtle)),
                  focusedBorder: OutlineInputBorder(borderSide: BorderSide(color: kPumpkin)),
                  isDense: true,
                ),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: leadTimeCtrl,
                keyboardType: TextInputType.number,
                style: const TextStyle(color: kParchment, fontSize: 13),
                decoration: const InputDecoration(
                  labelText: "Lead Time (Days)",
                  labelStyle: TextStyle(color: kGold, fontSize: 12),
                  enabledBorder: OutlineInputBorder(borderSide: BorderSide(color: kBorderSubtle)),
                  focusedBorder: OutlineInputBorder(borderSide: BorderSide(color: kPumpkin)),
                  isDense: true,
                ),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text("Cancel", style: TextStyle(color: Colors.white60)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: kPumpkin,
              foregroundColor: kParchment,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
            ),
            onPressed: () async {
              final name = nameCtrl.text.trim();
              if (name.isEmpty) return;
              Navigator.pop(ctx);
              await addNewIngredient({
                "name": name,
                "current_stock": int.tryParse(stockCtrl.text.trim()) ?? 50,
                "safety_stock": int.tryParse(safetyCtrl.text.trim()) ?? 15,
                "supplier": supplierCtrl.text.trim(),
                "lead_time_days": int.tryParse(leadTimeCtrl.text.trim()) ?? 3,
              });
            },
            child: const Text("Save to Vault", style: TextStyle(fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  Future<void> addNewIngredient(Map<String, dynamic> payload) async {
    setState(() => isLoading = true);
    try {
      final sanitizedBase = serverBaseUrl.trim().replaceAll(RegExp(r'/+$'), '');
      await http.post(
        Uri.parse("$sanitizedBase/api/pantry"),
        headers: {"Content-Type": "application/json"},
        body: jsonEncode(payload),
      );
      await testAndFetchPantry();
    } catch (_) {
      setState(() => isLoading = false);
    }
  }

  void openSettingsDialog() {
    final controller = TextEditingController(text: serverBaseUrl);
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: kPanel,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(14),
          side: const BorderSide(color: kPumpkin, width: 1.2),
        ),
        title: Row(
          children: const [
            Icon(Icons.tune_rounded, color: kPumpkin, size: 20),
            SizedBox(width: 8),
            Text(
              "Vault Host Settings",
              style: TextStyle(fontFamily: 'serif', fontSize: 16, fontWeight: FontWeight.bold, color: kParchment),
            ),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              "FastAPI server host address (port 8000):",
              style: TextStyle(fontSize: 11.5, color: Colors.white70),
            ),
            const SizedBox(height: 8),
            TextField(
              controller: controller,
              style: const TextStyle(color: kParchment, fontSize: 13, fontFamily: 'monospace'),
              decoration: const InputDecoration(
                enabledBorder: OutlineInputBorder(borderSide: BorderSide(color: kBorderSubtle)),
                focusedBorder: OutlineInputBorder(borderSide: BorderSide(color: kPumpkin)),
                hintText: "http://192.168.x.x:8000",
                isDense: true,
              ),
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 6,
              children: [
                ActionChip(
                  backgroundColor: kNight,
                  label: const Text("Wi-Fi LAN", style: TextStyle(fontSize: 11, color: kParchment)),
                  onPressed: () => controller.text = "http://$detectedLanIp:8000",
                ),
                ActionChip(
                  backgroundColor: kNight,
                  label: const Text("Emulator", style: TextStyle(fontSize: 11, color: kParchment)),
                  onPressed: () => controller.text = "http://10.0.2.2:8000",
                ),
                ActionChip(
                  backgroundColor: kNight,
                  label: const Text("Localhost", style: TextStyle(fontSize: 11, color: kParchment)),
                  onPressed: () => controller.text = "http://127.0.0.1:8000",
                ),
              ],
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text("Cancel", style: TextStyle(color: Colors.white60)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: kPumpkin,
              foregroundColor: kParchment,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
            ),
            onPressed: () {
              setState(() => serverBaseUrl = controller.text.trim());
              Navigator.pop(ctx);
              testAndFetchPantry();
            },
            child: const Text("Connect"),
          ),
        ],
      ),
    );
  }

  // =========================================================================
  // VIEW 1: DASHBOARD
  // =========================================================================
  Widget _buildDashboardView() {
    int totalUnits = 0;
    int shortageCount = 0;
    double totalWorth = 0.0;

    for (var item in pantry) {
      final stock = (item['current_stock'] as num?)?.toInt() ?? 0;
      final safety = (item['safety_stock'] as num?)?.toInt() ?? 0;
      totalUnits += stock;
      if (stock < safety) shortageCount++;
      totalWorth += stock * 6.5;
    }

    final lowStockItems = pantry.where((i) {
      final stock = (i['current_stock'] as num?)?.toInt() ?? 0;
      final safety = (i['safety_stock'] as num?)?.toInt() ?? 0;
      return stock < safety;
    }).toList();

    return RefreshIndicator(
      color: kPumpkin,
      backgroundColor: kPanel,
      onRefresh: testAndFetchPantry,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(12, 12, 12, 90),
        children: [
          // 4 Metric Tiles
          Row(
            children: [
              _buildStatTile("Total Reagents", "${pantry.length} Items", "$totalUnits tracked", kGold),
              const SizedBox(width: 8),
              _buildStatTile("Urgent Shortages", "$shortageCount Reagents", "Below safety threshold", kCrimson, isShortage: true),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              _buildStatTile("Full Moon Surge", "3.0x Surge", "Peak in 2 days", kPumpkin),
              const SizedBox(width: 8),
              _buildStatTile("Vault Value", "¢${totalWorth.toStringAsFixed(2)}", "Inventory worth", kGold),
            ],
          ),

          const SizedBox(height: 12),

          // Blood Moon Festival Banner Plate
          Container(
            padding: const EdgeInsets.all(13),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFF331524), Color(0xFF1B0E1E)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: kPumpkin, width: 1.1),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: const [
                        Text("🌕 ", style: TextStyle(fontSize: 15)),
                        Text(
                          "Blood Moon Peak Approaching",
                          style: TextStyle(fontFamily: 'serif', fontSize: 13.5, fontWeight: FontWeight.bold, color: kParchment),
                        ),
                      ],
                    ),
                    InkWell(
                      onTap: () => setState(() => currentTab = 2),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2.5),
                        decoration: BoxDecoration(
                          color: kPumpkin.withOpacity(0.2),
                          border: Border.all(color: kPumpkin, width: 0.8),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: const Text("Scry Restock →", style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.bold, color: kGold)),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                const Text(
                  "Demand for Bat Wings and Mandrake Root surges up to 300%. Check Scrying Forecast to prevent stockouts.",
                  style: TextStyle(fontSize: 10.5, color: Colors.white70, height: 1.3),
                ),
              ],
            ),
          ),

          const SizedBox(height: 14),

          // Depleted Ledger Header
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                "Urgent Stock Depletions",
                style: TextStyle(fontFamily: 'serif', fontSize: 14.5, fontWeight: FontWeight.bold, color: kParchment),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: lowStockItems.isEmpty ? Colors.green.withOpacity(0.18) : kCrimson.withOpacity(0.18),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(
                  lowStockItems.isEmpty ? "All Stocked" : "${lowStockItems.length} Urgent",
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.bold,
                    color: lowStockItems.isEmpty ? kSlime : const Color(0xFFFCA5A5),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),

          if (lowStockItems.isEmpty)
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: kCard,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: kBorderSubtle),
              ),
              child: const Center(
                child: Text(
                  "✦ All pantry reagents are sufficiently stocked above minimum thresholds.",
                  style: TextStyle(fontSize: 11.5, color: kSlime, fontStyle: FontStyle.italic),
                  textAlign: TextAlign.center,
                ),
              ),
            )
          else
            for (var item in lowStockItems) _buildDashLowStockTile(item),
        ],
      ),
    );
  }

  Widget _buildStatTile(String label, String val, String subtext, Color valColor, {bool isShortage = false}) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 9),
        decoration: BoxDecoration(
          color: isShortage ? kCrimsonBg : kPanel,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: isShortage ? kCrimson : kBorderSubtle),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: const TextStyle(fontSize: 9.5, fontWeight: FontWeight.bold, color: Colors.white60)),
            const SizedBox(height: 2),
            Text(val, style: TextStyle(fontFamily: 'serif', fontSize: 15, fontWeight: FontWeight.w900, color: valColor)),
            Text(subtext, style: TextStyle(fontSize: 9, color: isShortage ? const Color(0xFFFCA5A5) : Colors.white54)),
          ],
        ),
      ),
    );
  }

  Widget _buildDashLowStockTile(dynamic item) {
    final id = item['id'];
    final name = item['name'] ?? "Unknown";
    final stock = item['current_stock'] ?? 0;
    final safety = item['safety_stock'] ?? 0;
    final qty = restockQuantities[id] ?? 20;

    return Container(
      margin: const EdgeInsets.only(bottom: 7),
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: kCard,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: kBorderSubtle),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(name, style: const TextStyle(fontFamily: 'serif', fontSize: 13, fontWeight: FontWeight.bold, color: kParchment)),
                Text("Stock: $stock / Min: $safety", style: const TextStyle(fontSize: 10, color: Color(0xFFF87171))),
              ],
            ),
          ),
          Container(
            width: 76,
            height: 28,
            decoration: BoxDecoration(color: kNight, borderRadius: BorderRadius.circular(5), border: Border.all(color: kBorderSubtle)),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                InkWell(
                  onTap: () => setState(() => restockQuantities[id] = (qty - 5).clamp(5, 500)),
                  child: const Padding(padding: EdgeInsets.symmetric(horizontal: 6), child: Text("−", style: TextStyle(color: kGold, fontWeight: FontWeight.bold))),
                ),
                Text("$qty", style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: kParchment)),
                InkWell(
                  onTap: () => setState(() => restockQuantities[id] = qty + 5),
                  child: const Padding(padding: EdgeInsets.symmetric(horizontal: 6), child: Text("+", style: TextStyle(color: kGold, fontWeight: FontWeight.bold))),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: kPumpkin,
              foregroundColor: kParchment,
              padding: const EdgeInsets.symmetric(horizontal: 10),
              minimumSize: const Size(0, 28),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(5)),
            ),
            onPressed: () => adjustStock(id, qty, successMsg: "Restocked +$qty $name"),
            child: const Text("+ Restock", style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  // =========================================================================
  // VIEW 2: INVENTORY (BALANCED CARDS WITH SEARCH & FILTER CHIPS)
  // =========================================================================
  Widget _buildInventoryView() {
    final filtered = pantry.where((item) {
      final name = (item['name'] ?? "").toString().toLowerCase();
      final cat = (item['category'] ?? "").toString().toLowerCase();
      final sup = (item['supplier'] ?? "").toString().toLowerCase();
      final q = searchQuery.toLowerCase().trim();

      if (q.isNotEmpty && !name.contains(q) && !cat.contains(q) && !sup.contains(q)) {
        return false;
      }

      if (activeCategoryFilter == "low") {
        return (item['current_stock'] ?? 0) < (item['safety_stock'] ?? 0);
      }
      if (activeCategoryFilter == "cursed") {
        return item['is_cursed'] == true;
      }
      if (activeCategoryFilter == "animal") {
        return cat.contains("animal") || cat.contains("fauna") || cat.contains("parts");
      }
      if (activeCategoryFilter == "plant") {
        return cat.contains("plant") || cat.contains("flora") || cat.contains("roots") || cat.contains("herb");
      }
      return true;
    }).toList();

    return Column(
      children: [
        // Search & Filter Bar
        Container(
          padding: const EdgeInsets.fromLTRB(12, 10, 12, 6),
          color: kPanel,
          child: Column(
            children: [
              SizedBox(
                height: 36,
                child: TextField(
                  style: const TextStyle(color: kParchment, fontSize: 12),
                  onChanged: (val) => setState(() => searchQuery = val),
                  decoration: InputDecoration(
                    hintText: "Search reagents, parts, roots...",
                    hintStyle: const TextStyle(color: Colors.white38, fontSize: 11.5),
                    prefixIcon: const Icon(Icons.search, size: 16, color: Colors.white38),
                    filled: true,
                    fillColor: kNight,
                    contentPadding: EdgeInsets.zero,
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(6), borderSide: const BorderSide(color: kBorderSubtle)),
                    enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(6), borderSide: const BorderSide(color: kBorderSubtle)),
                  ),
                ),
              ),
              const SizedBox(height: 6),
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  children: [
                    _buildFilterChip("All", "all"),
                    _buildFilterChip("⚠️ Low Stock", "low"),
                    _buildFilterChip("🌕 3x Surge", "cursed"),
                    _buildFilterChip("Fauna", "animal"),
                    _buildFilterChip("Flora", "plant"),
                  ],
                ),
              ),
            ],
          ),
        ),

        // List View
        Expanded(
          child: RefreshIndicator(
            color: kPumpkin,
            backgroundColor: kPanel,
            onRefresh: testAndFetchPantry,
            child: filtered.isEmpty
                ? const Center(
                    child: Text("No matching reagents found", style: TextStyle(color: Colors.white54, fontSize: 13)),
                  )
                : ListView.builder(
                    padding: const EdgeInsets.fromLTRB(12, 8, 12, 90),
                    itemCount: filtered.length,
                    itemBuilder: (ctx, i) {
                      final item = filtered[i];
                      return _buildBalancedInventoryCard(item);
                    },
                  ),
          ),
        ),
      ],
    );
  }

  Widget _buildFilterChip(String label, String key) {
    final active = activeCategoryFilter == key;
    return Padding(
      padding: const EdgeInsets.only(right: 6),
      child: InkWell(
        onTap: () => setState(() => activeCategoryFilter = key),
        borderRadius: BorderRadius.circular(12),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
          decoration: BoxDecoration(
            color: active ? kPumpkin.withOpacity(0.2) : kCard,
            border: Border.all(color: active ? kPumpkin : kBorderSubtle),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Text(
            label,
            style: TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.bold,
              color: active ? kGold : Colors.white60,
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildBalancedInventoryCard(dynamic item) {
    final id = item['id'];
    final name = item['name'] ?? "Unknown";
    final currentStock = (item['current_stock'] as num?)?.toInt() ?? 0;
    final expectedStock = (item['expected_stock'] as num?)?.toInt() ?? currentStock;
    final safetyStock = (item['safety_stock'] as num?)?.toInt() ?? 10;
    final isCursed = item['is_cursed'] == true;
    final prophecy = item['prophecy'] ?? {};
    final burn = prophecy['daily_burn_rate'] ?? 0;
    final runOut = prophecy['days_until_run_out'] ?? 'N/A';
    final reorder = prophecy['recommended_reorder'] ?? 0;
    final category = item['category'] ?? "Apothecary Reagent";
    final anomalies = (item['anomalies'] as List?) ?? [];
    final qty = restockQuantities[id] ?? 20;

    final isLow = currentStock < safetyStock;
    final gaugeTarget = safetyStock * 2 > 0 ? safetyStock * 2 : 50;
    final stockRatio = (currentStock / gaugeTarget).clamp(0.0, 1.0);

    final missingAlerts = anomalies.where((a) => a is Map && a['type'] == 'MISSING_STOCK').toList();
    final spikeAlerts = anomalies.where((a) => a is Map && a['type'] != 'MISSING_STOCK').toList();

    return Card(
      margin: const EdgeInsets.only(bottom: 9),
      color: kCard,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(9),
        side: BorderSide(color: isCursed ? kPumpkin : kBorderSubtle, width: isCursed ? 1.3 : 1.0),
      ),
      child: Padding(
        padding: const EdgeInsets.all(11),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Top Row
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Text(
                    name,
                    style: const TextStyle(fontFamily: 'serif', fontSize: 15.5, fontWeight: FontWeight.bold, color: kParchment),
                  ),
                ),
                if (isCursed)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: kPumpkin.withOpacity(0.2),
                      border: Border.all(color: kPumpkin, width: 0.8),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Text("🌕 3.0x SURGE", style: TextStyle(fontSize: 9, fontWeight: FontWeight.bold, color: kGold)),
                  )
                else
                  Text(category, style: const TextStyle(fontSize: 9.5, color: Colors.white54)),
              ],
            ),

            // Soft Botanical Potion Gauge
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 6),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(3),
                child: SizedBox(
                  height: 4,
                  child: LinearProgressIndicator(
                    value: stockRatio,
                    backgroundColor: Colors.black45,
                    valueColor: AlwaysStoppedAnimation<Color>(isLow ? const Color(0xFFF87171) : kSlime),
                  ),
                ),
              ),
            ),

            // 3-Column Metrics Grid
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
              decoration: BoxDecoration(color: kNight, borderRadius: BorderRadius.circular(5), border: Border.all(color: kBorderSubtle)),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      children: [
                        const Text("STOCK ON HAND", style: TextStyle(fontSize: 7.5, fontWeight: FontWeight.bold, color: Colors.white54)),
                        Text("$currentStock", style: TextStyle(fontSize: 14.5, fontWeight: FontWeight.w900, color: isLow ? const Color(0xFFF87171) : kSlime)),
                      ],
                    ),
                  ),
                  Expanded(
                    child: Column(
                      children: [
                        const Text("EXPECTED", style: TextStyle(fontSize: 7.5, fontWeight: FontWeight.bold, color: Colors.white54)),
                        Text("$expectedStock", style: const TextStyle(fontSize: 14.5, fontWeight: FontWeight.w900, color: kParchment)),
                      ],
                    ),
                  ),
                  Expanded(
                    child: Column(
                      children: [
                        const Text("BURN RATE", style: TextStyle(fontSize: 7.5, fontWeight: FontWeight.bold, color: Colors.white54)),
                        Text("${burn}/day", style: const TextStyle(fontSize: 14.5, fontWeight: FontWeight.w900, color: kPumpkin)),
                      ],
                    ),
                  ),
                ],
              ),
            ),

            // Prescription Strip
            Padding(
              padding: const EdgeInsets.only(top: 6, bottom: 6),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text("Run out: ${runOut}d", style: const TextStyle(fontSize: 10.5, color: Colors.white70)),
                  Text("Reorder prescription: $reorder units", style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.bold, color: kGold)),
                ],
              ),
            ),

            // Anomaly Tags
            if (missingAlerts.isNotEmpty || spikeAlerts.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(bottom: 6),
                child: Wrap(
                  spacing: 6,
                  runSpacing: 4,
                  children: [
                    if (missingAlerts.isNotEmpty)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(color: kCrimsonBg, border: Border.all(color: kCrimson), borderRadius: BorderRadius.circular(4)),
                        child: Text("🚨 5 Units Missing", style: const TextStyle(fontSize: 9.5, color: Color(0xFFFCA5A5), fontWeight: FontWeight.bold)),
                      ),
                    if (spikeAlerts.isNotEmpty)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(color: const Color(0xFF251229), border: Border.all(color: kPumpkinDim), borderRadius: BorderRadius.circular(4)),
                        child: Text("⚡ ${spikeAlerts.length} Surges Recorded", style: const TextStyle(fontSize: 9.5, color: kGold, fontWeight: FontWeight.bold)),
                      ),
                  ],
                ),
              ),

            // Balanced Action Bar: Stepper + Restock Button + Audit Icon
            Row(
              children: [
                Container(
                  width: 82,
                  height: 32,
                  decoration: BoxDecoration(color: kNight, borderRadius: BorderRadius.circular(6), border: Border.all(color: kBorderSubtle)),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      InkWell(
                        onTap: () => setState(() => restockQuantities[id] = (qty - 5).clamp(5, 500)),
                        child: const Padding(padding: EdgeInsets.symmetric(horizontal: 8), child: Text("−", style: TextStyle(color: kGold, fontWeight: FontWeight.bold, fontSize: 13))),
                      ),
                      Text("$qty", style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.bold, color: kParchment)),
                      InkWell(
                        onTap: () => setState(() => restockQuantities[id] = qty + 5),
                        child: const Padding(padding: EdgeInsets.symmetric(horizontal: 8), child: Text("+", style: TextStyle(color: kGold, fontWeight: FontWeight.bold, fontSize: 13))),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: SizedBox(
                    height: 32,
                    child: ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: kPumpkin,
                        foregroundColor: kParchment,
                        padding: EdgeInsets.zero,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
                      ),
                      onPressed: () => adjustStock(id, qty, successMsg: "Restocked +$qty $name"),
                      child: const Text("+ Restock", style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                    ),
                  ),
                ),
                const SizedBox(width: 6),
                SizedBox(
                  height: 32,
                  width: 34,
                  child: IconButton(
                    padding: EdgeInsets.zero,
                    style: IconButton.styleFrom(backgroundColor: kCrimsonBg, side: const BorderSide(color: kCrimson)),
                    icon: const Icon(Icons.warning_amber_rounded, size: 16, color: Color(0xFFFCA5A5)),
                    onPressed: () => reportMissingStock(id),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  // =========================================================================
  // VIEW 3: FORECAST & RESTOCK
  // =========================================================================
  Widget _buildForecastView() {
    final selectedItem = pantry.firstWhere(
      (i) => i['id'] == selectedForecastItemId,
      orElse: () => pantry.isNotEmpty ? pantry.first : {},
    );

    final prophecy = selectedItem['prophecy'] ?? {};
    final burnRate = prophecy['daily_burn_rate'] ?? 0;
    final runOutDays = prophecy['days_until_run_out'] ?? 'N/A';
    final recommendedReorder = prophecy['recommended_reorder'] ?? 0;
    final sevenDayDemand = (burnRate is num ? burnRate * 7 : 0).round();

    return RefreshIndicator(
      color: kPumpkin,
      backgroundColor: kPanel,
      onRefresh: testAndFetchPantry,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(12, 12, 12, 90),
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12),
            decoration: BoxDecoration(color: kPanel, borderRadius: BorderRadius.circular(8), border: Border.all(color: kBorderSubtle)),
            child: DropdownButtonHideUnderline(
              child: DropdownButton<dynamic>(
                value: selectedForecastItemId,
                dropdownColor: kPanel,
                isExpanded: true,
                items: [
                  for (var item in pantry)
                    DropdownMenuItem(
                      value: item['id'],
                      child: Text("${item['name']} (${item['current_stock']} on hand)", style: const TextStyle(color: kParchment, fontSize: 13)),
                    ),
                ],
                onChanged: (val) => setState(() => selectedForecastItemId = val),
              ),
            ),
          ),
          const SizedBox(height: 12),
          if (selectedItem.isNotEmpty)
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(color: kCard, borderRadius: BorderRadius.circular(10), border: Border.all(color: kPumpkin)),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text("${selectedItem['name']}", style: const TextStyle(fontFamily: 'serif', fontSize: 16, fontWeight: FontWeight.bold, color: kGold)),
                      Text("Runout: ${runOutDays}d", style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: kParchment)),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text("Supplier: ${selectedItem['supplier'] ?? 'Apothecary Wholesaler'} (${selectedItem['lead_time_days'] ?? 3}d Lead)", style: const TextStyle(fontSize: 10.5, color: Colors.white54)),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Expanded(child: _buildProphecyTile("7-DAY DEMAND", "$sevenDayDemand units", kGold)),
                      const SizedBox(width: 6),
                      Expanded(child: _buildProphecyTile("BURN RATE", "$burnRate / day", kPumpkin)),
                      const SizedBox(width: 6),
                      Expanded(child: _buildProphecyTile("REORDER REQ", "$recommendedReorder units", kSlime)),
                    ],
                  ),
                ],
              ),
            ),
          const SizedBox(height: 14),
          const Text("All Pantry Restock Recommendations", style: TextStyle(fontFamily: 'serif', fontSize: 14, fontWeight: FontWeight.bold, color: kParchment)),
          const SizedBox(height: 8),
          for (var item in pantry) _buildRestockRow(item),
        ],
      ),
    );
  }

  Widget _buildProphecyTile(String label, String val, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 4),
      decoration: BoxDecoration(color: kNight, borderRadius: BorderRadius.circular(5), border: Border.all(color: kBorderSubtle)),
      child: Column(
        children: [
          Text(label, style: const TextStyle(fontSize: 7.5, fontWeight: FontWeight.bold, color: Colors.white54)),
          const SizedBox(height: 2),
          Text(val, style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: color)),
        ],
      ),
    );
  }

  Widget _buildRestockRow(dynamic item) {
    final id = item['id'];
    final name = item['name'] ?? "Unknown";
    final stock = item['current_stock'] ?? 0;
    final safety = item['safety_stock'] ?? 10;
    final prophecy = item['prophecy'] ?? {};
    final reorder = prophecy['recommended_reorder'] ?? 0;

    return Container(
      margin: const EdgeInsets.only(bottom: 7),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(color: kCard, borderRadius: BorderRadius.circular(8), border: Border.all(color: reorder > 0 ? kPumpkin : kBorderSubtle)),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(name, style: const TextStyle(fontFamily: 'serif', fontSize: 13, fontWeight: FontWeight.bold, color: kParchment)),
                Text("Stock: $stock | Min: $safety", style: const TextStyle(fontSize: 10, color: Colors.white54)),
              ],
            ),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: reorder > 0 ? kPumpkin : kPanel,
              foregroundColor: kParchment,
              minimumSize: const Size(0, 28),
              padding: const EdgeInsets.symmetric(horizontal: 10),
            ),
            onPressed: () => adjustStock(id, reorder > 0 ? reorder : 10, successMsg: "Restock order placed for $name!"),
            child: Text(reorder > 0 ? "+ Order $reorder" : "+ Order 10", style: const TextStyle(fontSize: 10)),
          ),
        ],
      ),
    );
  }

  // =========================================================================
  // VIEW 4: RECORD SALE
  // =========================================================================
  Widget _buildRecordSaleView() {
    final selectedItem = pantry.firstWhere(
      (i) => i['id'] == selectedSaleItemId,
      orElse: () => pantry.isNotEmpty ? pantry.first : {},
    );
    final currentStock = selectedItem['current_stock'] ?? 0;

    return ListView(
      padding: const EdgeInsets.fromLTRB(14, 14, 14, 90),
      children: [
        const Text("Record Customer Sale", style: TextStyle(fontFamily: 'serif', fontSize: 16.5, fontWeight: FontWeight.bold, color: kParchment)),
        const SizedBox(height: 3),
        const Text("Atomic ledger deduction with real-time stock balance audit.", style: TextStyle(fontSize: 11, color: Colors.white60)),
        const SizedBox(height: 14),
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(color: kPanel, borderRadius: BorderRadius.circular(8), border: Border.all(color: kBorderSubtle)),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text("Select Reagent Sold:", style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.bold, color: kGold)),
              const SizedBox(height: 6),
              DropdownButtonHideUnderline(
                child: DropdownButton<dynamic>(
                  value: selectedSaleItemId,
                  dropdownColor: kPanel,
                  isExpanded: true,
                  items: [
                    for (var item in pantry)
                      DropdownMenuItem(
                        value: item['id'],
                        child: Text("${item['name']} (${item['current_stock']} in vault)", style: const TextStyle(color: kParchment, fontSize: 13)),
                      ),
                  ],
                  onChanged: (val) => setState(() => selectedSaleItemId = val),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(color: kPanel, borderRadius: BorderRadius.circular(8), border: Border.all(color: kBorderSubtle)),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text("Sale Quantity:", style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.bold, color: kGold)),
              const SizedBox(height: 8),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  IconButton.filled(
                    style: IconButton.styleFrom(backgroundColor: kNight),
                    icon: const Icon(Icons.remove, color: kGold),
                    onPressed: () {
                      if (saleQuantity > 1) setState(() => saleQuantity--);
                    },
                  ),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 20),
                    child: Text("$saleQuantity", style: const TextStyle(fontFamily: 'serif', fontSize: 22, fontWeight: FontWeight.bold, color: kParchment)),
                  ),
                  IconButton.filled(
                    style: IconButton.styleFrom(backgroundColor: kNight),
                    icon: const Icon(Icons.add, color: kGold),
                    onPressed: () {
                      if (saleQuantity < currentStock) setState(() => saleQuantity++);
                    },
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        SizedBox(
          width: double.infinity,
          height: 44,
          child: ElevatedButton.icon(
            style: ElevatedButton.styleFrom(
              backgroundColor: kPumpkin,
              foregroundColor: kParchment,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
            onPressed: currentStock <= 0
                ? null
                : () async {
                    final itemId = selectedSaleItemId;
                    final qty = saleQuantity;
                    await adjustStock(itemId, -qty, successMsg: "✦ Sale recorded: -$qty ${selectedItem['name']}");
                    setState(() => saleQuantity = 1);
                  },
            icon: const Icon(Icons.check_circle_outline, size: 17),
            label: Text(currentStock <= 0 ? "Depleted - Cannot Sell" : "Authorize & Deduct Stock", style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12.5)),
          ),
        ),
      ],
    );
  }

  // =========================================================================
  // MAIN SCAFFOLD WITH WELL-POSITIONED FAB
  // =========================================================================
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Row(
          children: [
            Container(
              width: 30,
              height: 30,
              decoration: BoxDecoration(color: const Color(0xFF3B1D4F), shape: BoxShape.circle, border: Border.all(color: kPumpkin, width: 1.1)),
              child: const Center(child: Text("⚗️", style: TextStyle(fontSize: 15))),
            ),
            const SizedBox(width: 8),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: const [
                Text("HEXLEY'S PANTRY", style: TextStyle(fontFamily: 'serif', fontSize: 14, fontWeight: FontWeight.w900, color: kParchment, letterSpacing: 1.1)),
                Text("EST. 1888 • VAULT LEDGER", style: TextStyle(fontSize: 8, fontWeight: FontWeight.w700, color: kGold, letterSpacing: 0.9)),
              ],
            ),
          ],
        ),
        actions: [
          IconButton(icon: const Icon(Icons.tune_rounded, size: 19, color: kParchment), tooltip: "Host Settings", onPressed: openSettingsDialog),
          IconButton(icon: const Icon(Icons.refresh_rounded, size: 19, color: kParchment), tooltip: "Sync Ledger", onPressed: testAndFetchPantry),
        ],
      ),
      body: Column(
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 5),
            decoration: const BoxDecoration(color: Color(0xFF190C24), border: Border(bottom: BorderSide(color: kBorderSubtle))),
            child: Row(
              children: [
                Icon(Icons.circle, size: 8, color: isConnected ? kSlime : kCrimson),
                const SizedBox(width: 7),
                Text(isConnected ? "Vault Ledger Synchronized" : "Vault Disconnected", style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w600, color: isConnected ? kParchment : const Color(0xFFFCA5A5))),
                const SizedBox(width: 6),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                  decoration: BoxDecoration(color: Colors.black45, borderRadius: BorderRadius.circular(4), border: Border.all(color: kBorderSubtle, width: 0.8)),
                  child: Text(":" + (serverBaseUrl.split(":").last), style: const TextStyle(fontSize: 8.5, fontFamily: 'monospace', color: kSlime)),
                ),
                const Spacer(),
                InkWell(
                  onTap: openSettingsDialog,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(border: Border.all(color: kPumpkinDim), borderRadius: BorderRadius.circular(4)),
                    child: const Text("SWITCH", style: TextStyle(fontSize: 8.5, fontWeight: FontWeight.w800, color: kPumpkin)),
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            child: isLoading && pantry.isEmpty
                ? const Center(child: CircularProgressIndicator(color: kPumpkin))
                : IndexedStack(
                    index: currentTab,
                    children: [
                      _buildDashboardView(),
                      _buildInventoryView(),
                      _buildForecastView(),
                      _buildRecordSaleView(),
                    ],
                  ),
          ),
        ],
      ),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: currentTab,
        onTap: (index) => setState(() => currentTab = index),
        type: BottomNavigationBarType.fixed,
        backgroundColor: kPanel,
        selectedItemColor: kPumpkin,
        unselectedItemColor: Colors.white54,
        selectedLabelStyle: const TextStyle(fontWeight: FontWeight.bold, fontSize: 11),
        unselectedLabelStyle: const TextStyle(fontSize: 10.5),
        items: const [
          BottomNavigationBarItem(icon: Icon(Icons.dashboard_rounded), label: "Dashboard"),
          BottomNavigationBarItem(icon: Icon(Icons.inventory_2_rounded), label: "Inventory"),
          BottomNavigationBarItem(icon: Icon(Icons.auto_graph_rounded), label: "Forecast"),
          BottomNavigationBarItem(icon: Icon(Icons.point_of_sale_rounded), label: "Sale"),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: kPumpkin,
        foregroundColor: kParchment,
        elevation: 4,
        icon: const Icon(Icons.add, color: kGold, size: 17),
        label: const Text("Add Reagent", style: TextStyle(fontFamily: 'serif', fontWeight: FontWeight.w800, letterSpacing: 0.5, fontSize: 12)),
        onPressed: openAddIngredientDialog,
      ),
    );
  }
}
