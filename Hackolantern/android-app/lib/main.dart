import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

// ============================================================================
// HEXLEY'S POTION PANTRY — AUTHENTIC VICTORIAN APOTHECARY DESIGN SYSTEM
// ============================================================================
const Color kNight = Color(0xFF140A1D);       // Deep midnight page background
const Color kPanel = Color(0xFF2A1A36);       // Dark velvet apothecary panel
const Color kCard = Color(0xFF1D1027);        // Deep chamber
const Color kParchment = Color(0xFFECDCCC);   // Authentic aged parchment paper
const Color kParchmentLight = Color(0xFFF7ECD5);
const Color kInk = Color(0xFF2B1D14);         // Antique dark ink
const Color kInkMuted = Color(0xFF5E4533);    // Subdued ledger ink
const Color kPumpkin = Color(0xFFFF7518);     // Signature pumpkin copper
const Color kGold = Color(0xFFF2B25C);        // Heading gold
const Color kSlime = Color(0xFF7FFF5A);       // Poison / Emerald glow
const Color kViolet = Color(0xFF8A4FD1);      // Witch violet
const Color kCrimson = Color(0xFF9B1C1C);     // Urgent shortage crimson
const Color kBorderParchment = Color(0x382B1D14);

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
        cardColor: kParchment,
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

  int currentTab = 0; // 0: Vault & Ledger, 1: Forecast, 2: Sale, 3: Ops
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
        body: jsonEncode({"actual_stock": 0}),
      );
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text("🚨 Declared stockout: inventory zeroed in vault"),
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
        backgroundColor: kParchment,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(6),
          side: const BorderSide(color: kPumpkin, width: 2),
        ),
        title: Row(
          children: const [
            Text("✦ ", style: TextStyle(color: kPumpkin, fontSize: 18)),
            Text(
              "Register New Reagent",
              style: TextStyle(fontFamily: 'serif', fontSize: 18, fontWeight: FontWeight.bold, color: kInk),
            ),
          ],
        ),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: nameCtrl,
                style: const TextStyle(color: kInk, fontSize: 14),
                decoration: const InputDecoration(
                  labelText: "Ingredient Name",
                  labelStyle: TextStyle(color: kInkMuted, fontSize: 12),
                  hintText: "e.g. Phoenix Feather",
                  enabledBorder: OutlineInputBorder(borderSide: BorderSide(color: kBorderParchment)),
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
                      style: const TextStyle(color: kInk, fontSize: 14),
                      decoration: const InputDecoration(
                        labelText: "Current Stock",
                        labelStyle: TextStyle(color: kInkMuted, fontSize: 11),
                        enabledBorder: OutlineInputBorder(borderSide: BorderSide(color: kBorderParchment)),
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
                      style: const TextStyle(color: kInk, fontSize: 14),
                      decoration: const InputDecoration(
                        labelText: "Safety Threshold",
                        labelStyle: TextStyle(color: kInkMuted, fontSize: 11),
                        enabledBorder: OutlineInputBorder(borderSide: BorderSide(color: kBorderParchment)),
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
                style: const TextStyle(color: kInk, fontSize: 14),
                decoration: const InputDecoration(
                  labelText: "Supplier",
                  labelStyle: TextStyle(color: kInkMuted, fontSize: 12),
                  enabledBorder: OutlineInputBorder(borderSide: BorderSide(color: kBorderParchment)),
                  focusedBorder: OutlineInputBorder(borderSide: BorderSide(color: kPumpkin)),
                  isDense: true,
                ),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: leadTimeCtrl,
                keyboardType: TextInputType.number,
                style: const TextStyle(color: kInk, fontSize: 14),
                decoration: const InputDecoration(
                  labelText: "Lead Time (Days)",
                  labelStyle: TextStyle(color: kInkMuted, fontSize: 12),
                  enabledBorder: OutlineInputBorder(borderSide: BorderSide(color: kBorderParchment)),
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
            child: const Text("Cancel", style: TextStyle(color: kInkMuted)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: kInk,
              foregroundColor: kParchment,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
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
        backgroundColor: kParchment,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(6),
          side: const BorderSide(color: kPumpkin, width: 2),
        ),
        title: Row(
          children: const [
            Icon(Icons.tune_rounded, color: kPumpkin, size: 20),
            SizedBox(width: 8),
            Text(
              "Vault Host Settings",
              style: TextStyle(fontFamily: 'serif', fontSize: 18, fontWeight: FontWeight.bold, color: kInk),
            ),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              "Enter your computer's FastAPI backend IP address:",
              style: TextStyle(color: kInkMuted, fontSize: 12),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: controller,
              style: const TextStyle(color: kInk, fontSize: 13),
              decoration: const InputDecoration(
                labelText: "Server Endpoint",
                labelStyle: TextStyle(color: kInkMuted),
                enabledBorder: OutlineInputBorder(borderSide: BorderSide(color: kBorderParchment)),
                focusedBorder: OutlineInputBorder(borderSide: BorderSide(color: kPumpkin)),
                isDense: true,
              ),
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 6,
              children: [
                ActionChip(
                  backgroundColor: kParchmentLight,
                  side: const BorderSide(color: kBorderParchment),
                  label: const Text("Phone Wi-Fi (:8000)", style: TextStyle(fontSize: 11, color: kInk)),
                  onPressed: () => controller.text = "http://$detectedLanIp:8000",
                ),
                ActionChip(
                  backgroundColor: kParchmentLight,
                  side: const BorderSide(color: kBorderParchment),
                  label: const Text("Localhost", style: TextStyle(fontSize: 11, color: kInk)),
                  onPressed: () => controller.text = "http://localhost:8000",
                ),
              ],
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text("Cancel", style: TextStyle(color: kInkMuted)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: kInk,
              foregroundColor: kParchment,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
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
  // VIEW 1: VAULT & LEDGER (MATCHING DESKTOP WEBSITE)
  // =========================================================================
  Widget _buildVaultView() {
    int totalUnits = 0;
    int shortageCount = 0;
    double totalWorth = 0.0;

    for (var item in pantry) {
      final stock = (item['current_stock'] as num?)?.toInt() ?? 0;
      final safety = (item['safety_stock'] as num?)?.toInt() ?? 0;
      final price = (item['unit_price'] as num?)?.toDouble() ?? 10.0;
      totalUnits += stock;
      if (stock <= safety) shortageCount++;
      totalWorth += stock * price;
    }

    // Filter items
    final filtered = pantry.where((item) {
      final name = (item['name'] ?? "").toString().toLowerCase();
      final cat = (item['category'] ?? "").toString().toLowerCase();
      final q = searchQuery.toLowerCase().trim();

      if (q.isNotEmpty && !name.contains(q) && !cat.contains(q)) {
        return false;
      }
      if (activeCategoryFilter == "low") {
        return (item['current_stock'] ?? 0) <= (item['safety_stock'] ?? 0);
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

    return RefreshIndicator(
      color: kPumpkin,
      backgroundColor: kNight,
      onRefresh: testAndFetchPantry,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(14, 12, 14, 90),
        children: [
          // 4 Metric Tiles in Authentic Parchment
          Row(
            children: [
              _buildStatParchmentTile("Total Reagents", "${pantry.length} Items", "$totalUnits in vault"),
              const SizedBox(width: 8),
              _buildStatParchmentTile(
                "Urgent Shortages",
                "$shortageCount Items",
                shortageCount > 0 ? "Below safety" : "All Stocked",
                valColor: shortageCount > 0 ? kCrimson : const Color(0xFF2E6A45),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              _buildStatParchmentTile("Full Moon Surge", "3.0x Surge", "Peak in 2 days", valColor: kPumpkin),
              const SizedBox(width: 8),
              _buildStatParchmentTile("Vault Value", "¢${totalWorth.toStringAsFixed(2)}", "Ledger inventory"),
            ],
          ),

          const SizedBox(height: 14),

          // Blood Moon Festival Banner Plate
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: const Color(0xFF20132B),
              borderRadius: BorderRadius.circular(4),
              border: Border.all(color: kPumpkin, width: 1.2),
              boxShadow: [
                BoxShadow(color: kPumpkin.withOpacity(0.18), blurRadius: 16),
              ],
            ),
            child: Row(
              children: [
                const Text("🌕 ", style: TextStyle(fontSize: 24)),
                const SizedBox(width: 8),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: const [
                      Text(
                        "Blood Moon Festival Approaching",
                        style: TextStyle(fontFamily: 'serif', fontSize: 14, fontWeight: FontWeight.bold, color: kGold),
                      ),
                      SizedBox(height: 2),
                      Text(
                        "Bat Wings & Mandrake demand surges 300%. Check Scrying Forecast to avoid stockouts.",
                        style: TextStyle(fontSize: 11, color: Color(0xFFBFAE95), height: 1.3),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 16),

          // Section Title
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                "Pantry Botanical & Reagents",
                style: TextStyle(fontFamily: 'serif', fontSize: 17, fontWeight: FontWeight.bold, color: kPumpkin),
              ),
              Text(
                "${filtered.length} items",
                style: const TextStyle(fontSize: 12, color: kGold, fontStyle: FontStyle.italic),
              ),
            ],
          ),
          const SizedBox(height: 2),
          const Text(
            "Apothecary stock ledger with real-time depletion and restock orders.",
            style: TextStyle(fontSize: 12, color: Color(0xFFBFAE95), fontStyle: FontStyle.italic),
          ),
          const SizedBox(height: 10),

          // Search & Filter Bar
          SizedBox(
            height: 36,
            child: TextField(
              style: const TextStyle(color: kParchment, fontSize: 13),
              onChanged: (val) => setState(() => searchQuery = val),
              decoration: InputDecoration(
                hintText: "Search bat wings, roots, scales...",
                hintStyle: const TextStyle(color: Colors.white38, fontSize: 12),
                prefixIcon: const Icon(Icons.search, size: 16, color: kGold),
                filled: true,
                fillColor: const Color(0xFF1B1025),
                contentPadding: EdgeInsets.zero,
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(4), borderSide: const BorderSide(color: kPumpkin)),
                enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(4), borderSide: const BorderSide(color: kPumpkin)),
                focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(4), borderSide: const BorderSide(color: kGold)),
              ),
            ),
          ),
          const SizedBox(height: 8),

          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                _buildFilterPill("All Items", "all"),
                _buildFilterPill("⚠️ Low Stock", "low"),
                _buildFilterPill("🌕 3x Surge", "cursed"),
                _buildFilterPill("Fauna", "animal"),
                _buildFilterPill("Flora", "plant"),
              ],
            ),
          ),
          const SizedBox(height: 12),

          // Full Reagent List
          if (filtered.isEmpty)
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: kParchment,
                borderRadius: BorderRadius.circular(4),
                border: Border.all(color: kPumpkin, width: 2),
              ),
              child: const Center(
                child: Text(
                  "No apothecary ingredients match your search.",
                  style: TextStyle(color: kInk, fontWeight: FontWeight.bold, fontSize: 13),
                ),
              ),
            )
          else
            for (var item in filtered) _buildParchmentReagentCard(item),
        ],
      ),
    );
  }

  Widget _buildStatParchmentTile(String label, String val, String subtext, {Color? valColor}) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        decoration: BoxDecoration(
          color: kParchment,
          borderRadius: BorderRadius.circular(4),
          border: Border.all(color: kPumpkin, width: 2),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label.toUpperCase(), style: const TextStyle(fontSize: 9.5, fontWeight: FontWeight.w700, color: kInkMuted, letterSpacing: 0.5)),
            const SizedBox(height: 2),
            Text(val, style: TextStyle(fontFamily: 'serif', fontSize: 18, fontWeight: FontWeight.bold, color: valColor ?? kInk)),
            Text(subtext, style: const TextStyle(fontSize: 10, color: Color(0xFF2E6A45), fontStyle: FontStyle.italic)),
          ],
        ),
      ),
    );
  }

  Widget _buildFilterPill(String label, String key) {
    final active = activeCategoryFilter == key;
    return Padding(
      padding: const EdgeInsets.only(right: 6),
      child: InkWell(
        onTap: () => setState(() => activeCategoryFilter = key),
        borderRadius: BorderRadius.circular(100),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
          decoration: BoxDecoration(
            color: active ? kPumpkin : const Color(0x282B1D14),
            border: Border.all(color: active ? kPumpkin : const Color(0x66F2B25C)),
            borderRadius: BorderRadius.circular(100),
          ),
          child: Text(
            label,
            style: TextStyle(
              fontSize: 11,
              fontWeight: active ? FontWeight.bold : FontWeight.normal,
              color: active ? kInk : const Color(0xFFC4B59F),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildParchmentReagentCard(dynamic item) {
    final id = item['id'];
    final name = item['name'] ?? "Unknown";
    final currentStock = (item['current_stock'] as num?)?.toInt() ?? 0;
    final safetyStock = (item['safety_stock'] as num?)?.toInt() ?? 10;
    final burn = item['burn_rate_daily'] ?? (item['prophecy']?['daily_burn_rate'] ?? 2);
    final runOut = item['prophecy']?['days_until_run_out'] ?? 'N/A';
    final reorder = item['prophecy']?['recommended_reorder'] ?? 20;
    final category = item['category'] ?? "Apothecary Reagent";
    final isLow = currentStock <= safetyStock;
    final isDepleted = currentStock <= 0;
    final qty = restockQuantities[id] ?? 20;

    final gaugeTarget = safetyStock * 2 > 0 ? safetyStock * 2 : 50;
    final stockRatio = (currentStock / gaugeTarget).clamp(0.0, 1.0);

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: kParchment,
        borderRadius: BorderRadius.circular(4),
        border: Border.all(color: isDepleted ? kCrimson : (isLow ? kPumpkin : const Color(0x3D2B1D14)), width: isLow ? 1.5 : 1.0),
        boxShadow: const [
          BoxShadow(color: Colors.black26, blurRadius: 6, offset: Offset(0, 2)),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header row with Name and Category/Stamp
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  name,
                  style: const TextStyle(fontFamily: 'serif', fontSize: 17, fontWeight: FontWeight.bold, color: kInk),
                ),
              ),
              if (isDepleted)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: Colors.red.withOpacity(0.08),
                    border: Border.all(color: kCrimson),
                    borderRadius: BorderRadius.circular(2),
                  ),
                  child: const Text("SOLD OUT", style: TextStyle(fontFamily: 'serif', fontSize: 10, fontWeight: FontWeight.bold, color: kCrimson)),
                )
              else if (isLow)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: Colors.amber.withOpacity(0.1),
                    border: Border.all(color: const Color(0xFFD97706)),
                    borderRadius: BorderRadius.circular(2),
                  ),
                  child: const Text("LOW STOCK", style: TextStyle(fontFamily: 'serif', fontSize: 10, fontWeight: FontWeight.bold, color: Color(0xFFD97706))),
                )
              else
                Text(
                  category.toUpperCase(),
                  style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: Color(0xFF8A4A1C)),
                ),
            ],
          ),

          // Potion Fill Gauge
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 6),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(2),
              child: SizedBox(
                height: 5,
                child: LinearProgressIndicator(
                  value: stockRatio,
                  backgroundColor: const Color(0x282B1D14),
                  valueColor: AlwaysStoppedAnimation<Color>(isDepleted ? kCrimson : (isLow ? kPumpkin : const Color(0xFF2E6A45))),
                ),
              ),
            ),
          ),

          // 3-Column Metrics
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
            decoration: BoxDecoration(
              color: const Color(0x0C2B1D14),
              borderRadius: BorderRadius.circular(3),
              border: Border.all(color: const Color(0x1E2B1D14)),
            ),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    children: [
                      const Text("STOCK ON HAND", style: TextStyle(fontSize: 8.5, color: kInkMuted)),
                      Text("$currentStock", style: TextStyle(fontFamily: 'serif', fontSize: 15, fontWeight: FontWeight.bold, color: isLow ? kCrimson : const Color(0xFF2E6A45))),
                    ],
                  ),
                ),
                Expanded(
                  child: Column(
                    children: [
                      const Text("SAFETY TARGET", style: TextStyle(fontSize: 8.5, color: kInkMuted)),
                      Text("$safetyStock", style: const TextStyle(fontFamily: 'serif', fontSize: 15, fontWeight: FontWeight.bold, color: kInk)),
                    ],
                  ),
                ),
                Expanded(
                  child: Column(
                    children: [
                      const Text("BURN RATE", style: TextStyle(fontSize: 8.5, color: kInkMuted)),
                      Text("$burn/day", style: const TextStyle(fontFamily: 'serif', fontSize: 15, fontWeight: FontWeight.bold, color: Color(0xFF8A4A1C))),
                    ],
                  ),
                ),
              ],
            ),
          ),

          // Secondary details
          Padding(
            padding: const EdgeInsets.only(top: 6, bottom: 8),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text("Run out: $runOut", style: const TextStyle(fontSize: 11, color: kInkMuted)),
                Text("Reorder: $reorder units", style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF8A4A1C))),
              ],
            ),
          ),

          // Restock Stepper Action Row
          Row(
            children: [
              Container(
                width: 90,
                height: 32,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(3),
                  border: Border.all(color: const Color(0x4C2B1D14)),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    InkWell(
                      onTap: () => setState(() => restockQuantities[id] = (qty - 5).clamp(5, 500)),
                      child: const Padding(padding: EdgeInsets.symmetric(horizontal: 8), child: Text("−", style: TextStyle(color: kInk, fontWeight: FontWeight.bold, fontSize: 14))),
                    ),
                    Text("$qty", style: const TextStyle(fontFamily: 'serif', fontSize: 13, fontWeight: FontWeight.bold, color: kInk)),
                    InkWell(
                      onTap: () => setState(() => restockQuantities[id] = qty + 5),
                      child: const Padding(padding: EdgeInsets.symmetric(horizontal: 8), child: Text("+", style: TextStyle(color: kInk, fontWeight: FontWeight.bold, fontSize: 14))),
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
                      backgroundColor: kInk,
                      foregroundColor: kParchment,
                      elevation: 0,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(3)),
                    ),
                    onPressed: () => adjustStock(id, qty, successMsg: "Restocked +$qty $name"),
                    child: const Text("+ Restock", style: TextStyle(fontFamily: 'serif', fontSize: 12.5, fontWeight: FontWeight.bold)),
                  ),
                ),
              ),
              const SizedBox(width: 6),
              InkWell(
                onTap: () => reportMissingStock(id),
                child: Container(
                  width: 32,
                  height: 32,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(3),
                    border: Border.all(color: const Color(0x4D9B1C1C)),
                  ),
                  child: const Center(
                    child: Text("⚠️", style: TextStyle(fontSize: 14)),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  // =========================================================================
  // VIEW 2: SCRYING FORECAST & RESTOCK
  // =========================================================================
  Widget _buildForecastView() {
    return ListView(
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 90),
      children: [
        const Text(
          "Scrying Forecast & Restock",
          style: TextStyle(fontFamily: 'serif', fontSize: 18, fontWeight: FontWeight.bold, color: kPumpkin),
        ),
        const SizedBox(height: 2),
        const Text(
          "Predictive consumption curves and automated raven restock recommendations.",
          style: TextStyle(fontSize: 12, color: Color(0xFFBFAE95), fontStyle: FontStyle.italic),
        ),
        const SizedBox(height: 12),

        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: kParchment,
            borderRadius: BorderRadius.circular(4),
            border: Border.all(color: kPumpkin, width: 2),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text("🔮 Reagent Consumption Curve", style: TextStyle(fontFamily: 'serif', fontSize: 15, fontWeight: FontWeight.bold, color: kInk)),
              const SizedBox(height: 8),
              if (pantry.isNotEmpty)
                DropdownButton<dynamic>(
                  isExpanded: true,
                  value: selectedForecastItemId,
                  dropdownColor: kParchment,
                  style: const TextStyle(fontFamily: 'serif', color: kInk, fontSize: 14),
                  items: pantry.map<DropdownMenuItem<dynamic>>((item) {
                    return DropdownMenuItem(
                      value: item['id'],
                      child: Text("${item['name']} (${item['current_stock']} on hand)"),
                    );
                  }).toList(),
                  onChanged: (val) => setState(() => selectedForecastItemId = val),
                ),
              const SizedBox(height: 12),
              const Text("7-Day Predictive Runway:", style: TextStyle(fontSize: 12, color: kInkMuted)),
              const SizedBox(height: 4),
              Container(
                height: 50,
                width: double.infinity,
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: kParchmentLight,
                  borderRadius: BorderRadius.circular(3),
                  border: Border.all(color: const Color(0x382B1D14)),
                ),
                child: const Center(
                  child: Text("Depletion trajectory calculated via Exponential Smoothing", style: TextStyle(fontSize: 11, fontStyle: FontStyle.italic, color: kInkMuted)),
                ),
              ),
            ],
          ),
        ),

        const SizedBox(height: 14),

        // Restock Recommendations
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: kParchment,
            borderRadius: BorderRadius.circular(4),
            border: Border.all(color: kPumpkin, width: 2),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text("📜 All Restock Recommendations", style: TextStyle(fontFamily: 'serif', fontSize: 15, fontWeight: FontWeight.bold, color: kInk)),
              const SizedBox(height: 8),
              for (var item in pantry)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text("${item['name']}", style: const TextStyle(fontFamily: 'serif', fontSize: 13, fontWeight: FontWeight.bold, color: kInk)),
                      ElevatedButton(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: kInk,
                          foregroundColor: kParchment,
                          minimumSize: const Size(60, 26),
                          padding: const EdgeInsets.symmetric(horizontal: 8),
                        ),
                        onPressed: () => adjustStock(item['id'], 20, successMsg: "Restocked +20 ${item['name']}"),
                        child: const Text("Order +20", style: TextStyle(fontSize: 10)),
                      ),
                    ],
                  ),
                ),
            ],
          ),
        ),
      ],
    );
  }

  // =========================================================================
  // VIEW 3: RECORD SALE
  // =========================================================================
  Widget _buildSaleView() {
    return ListView(
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 90),
      children: [
        const Text(
          "Record Customer Sale",
          style: TextStyle(fontFamily: 'serif', fontSize: 18, fontWeight: FontWeight.bold, color: kPumpkin),
        ),
        const SizedBox(height: 2),
        const Text(
          "Atomic transaction dispensing reagents with real-time audit ledger deduction.",
          style: TextStyle(fontSize: 12, color: Color(0xFFBFAE95), fontStyle: FontStyle.italic),
        ),
        const SizedBox(height: 14),

        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: kParchment,
            borderRadius: BorderRadius.circular(4),
            border: Border.all(color: kPumpkin, width: 2),
            boxShadow: const [
              BoxShadow(color: Colors.black38, blurRadius: 10),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: const [
                  Text("Apothecary Dispensary", style: TextStyle(fontFamily: 'serif', fontSize: 17, fontWeight: FontWeight.bold, color: kInk)),
                  Text("✦", style: TextStyle(color: kCrimson, fontSize: 18)),
                ],
              ),
              const SizedBox(height: 12),
              const Text("Select Reagent Dispensed:", style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: kInkMuted)),
              const SizedBox(height: 4),
              if (pantry.isNotEmpty)
                DropdownButton<dynamic>(
                  isExpanded: true,
                  value: selectedSaleItemId,
                  dropdownColor: kParchment,
                  style: const TextStyle(fontFamily: 'serif', color: kInk, fontSize: 14),
                  items: pantry.map<DropdownMenuItem<dynamic>>((item) {
                    return DropdownMenuItem(
                      value: item['id'],
                      child: Text("${item['name']} (${item['current_stock']} in vault)"),
                    );
                  }).toList(),
                  onChanged: (val) => setState(() => selectedSaleItemId = val),
                ),
              const SizedBox(height: 14),
              const Text("Dispense Quantity:", style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: kInkMuted)),
              const SizedBox(height: 6),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  IconButton(
                    icon: const Icon(Icons.remove_circle_outline, color: kInk),
                    onPressed: () => setState(() => saleQuantity = (saleQuantity - 1).clamp(1, 100)),
                  ),
                  Text("$saleQuantity", style: const TextStyle(fontFamily: 'serif', fontSize: 24, fontWeight: FontWeight.bold, color: kInk)),
                  IconButton(
                    icon: const Icon(Icons.add_circle_outline, color: kInk),
                    onPressed: () => setState(() => saleQuantity += 1),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              SizedBox(
                width: double.infinity,
                height: 42,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: kInk,
                    foregroundColor: kParchment,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
                  ),
                  onPressed: () {
                    if (selectedSaleItemId != null) {
                      adjustStock(selectedSaleItemId, -saleQuantity, successMsg: "Dispensed $saleQuantity units");
                      setState(() => saleQuantity = 1);
                    }
                  },
                  child: const Text("Tally & Dispense Reagent →", style: TextStyle(fontFamily: 'serif', fontSize: 14, fontWeight: FontWeight.bold)),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  // =========================================================================
  // VIEW 4: OPS & TELEMETRY
  // =========================================================================
  Widget _buildOpsView() {
    return ListView(
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 90),
      children: [
        const Text(
          "Suppliers & Telemetry",
          style: TextStyle(fontFamily: 'serif', fontSize: 18, fontWeight: FontWeight.bold, color: kPumpkin),
        ),
        const SizedBox(height: 2),
        const Text(
          "Configure backend ledger endpoints and apothecary vault connectivity.",
          style: TextStyle(fontSize: 12, color: Color(0xFFBFAE95), fontStyle: FontStyle.italic),
        ),
        const SizedBox(height: 14),

        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: kParchment,
            borderRadius: BorderRadius.circular(4),
            border: Border.all(color: kPumpkin, width: 2),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text("FastAPI Vault Endpoint", style: TextStyle(fontFamily: 'serif', fontSize: 16, fontWeight: FontWeight.bold, color: kInk)),
              const SizedBox(height: 6),
              Text("Current URL: $serverBaseUrl", style: const TextStyle(fontSize: 12, color: kInkMuted)),
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(backgroundColor: kInk, foregroundColor: kParchment),
                  onPressed: openSettingsDialog,
                  child: const Text("Change Host IP / Reconnect"),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: kNight,
      appBar: AppBar(
        backgroundColor: kPanel,
        title: Row(
          children: const [
            Text("🎃 ", style: TextStyle(fontSize: 20)),
            Text(
              "Hexley's Pantry",
              style: TextStyle(fontFamily: 'serif', fontSize: 18, fontWeight: FontWeight.bold, color: kPumpkin),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.tune_rounded, color: kGold),
            onPressed: openSettingsDialog,
          ),
          IconButton(
            icon: const Icon(Icons.refresh_rounded, color: kGold),
            onPressed: testAndFetchPantry,
          ),
        ],
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(26),
          child: Container(
            height: 26,
            padding: const EdgeInsets.symmetric(horizontal: 14),
            color: const Color(0xFF190D24),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    Container(
                      width: 7,
                      height: 7,
                      decoration: BoxDecoration(
                        color: isConnected ? kSlime : Colors.red,
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: 6),
                    Text(
                      connectionMessage,
                      style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: kParchment),
                    ),
                  ],
                ),
                InkWell(
                  onTap: openSettingsDialog,
                  child: const Text("SWITCH", style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: kPumpkin)),
                ),
              ],
            ),
          ),
        ),
      ),
      body: currentTab == 0
          ? _buildVaultView()
          : currentTab == 1
              ? _buildForecastView()
              : currentTab == 2
                  ? _buildSaleView()
                  : _buildOpsView(),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: kInk,
        foregroundColor: kParchment,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(30),
          side: const BorderSide(color: kPumpkin, width: 2),
        ),
        onPressed: openAddIngredientDialog,
        icon: const Icon(Icons.add, color: kPumpkin, size: 18),
        label: const Text("Add Reagent", style: TextStyle(fontFamily: 'serif', fontWeight: FontWeight.bold)),
      ),
      bottomNavigationBar: NavigationBarTheme(
        data: NavigationBarThemeData(
          backgroundColor: const Color(0xFF170D24),
          indicatorColor: kPumpkin.withOpacity(0.2),
          labelTextStyle: MaterialStateProperty.resolveWith((states) {
            final active = states.contains(MaterialState.selected);
            return TextStyle(
              fontSize: 11,
              fontWeight: active ? FontWeight.bold : FontWeight.normal,
              color: active ? kPumpkin : const Color(0xFFA493B3),
            );
          }),
          iconTheme: MaterialStateProperty.resolveWith((states) {
            final active = states.contains(MaterialState.selected);
            return IconThemeData(
              color: active ? kPumpkin : const Color(0xFFA493B3),
              size: 20,
            );
          }),
        ),
        child: NavigationBar(
          selectedIndex: currentTab,
          onDestinationSelected: (idx) => setState(() => currentTab = idx),
          destinations: const [
            NavigationDestination(icon: Icon(Icons.grid_view_rounded), label: "Vault"),
            NavigationDestination(icon: Icon(Icons.auto_graph_rounded), label: "Forecast"),
            NavigationDestination(icon: Icon(Icons.shopping_cart_rounded), label: "Sale"),
            NavigationDestination(icon: Icon(Icons.tune_rounded), label: "Ops"),
          ],
        ),
      ),
    );
  }
}
