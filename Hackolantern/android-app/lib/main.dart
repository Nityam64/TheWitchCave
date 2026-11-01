import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

// ============================================================================
// VICTORIAN APOTHECARY DESIGN TOKENS (EXACT WEB DASHBOARD MATCH)
// ============================================================================
const Color kBgPrimary = Color(0xFF110C18);
const Color kBgSurface = Color(0xFF171120);
const Color kBgCard = Color(0xFF1C1527);
const Color kBgElevated = Color(0xFF231B31);
const Color kBorderSubtle = Color(0xFF362945);
const Color kBorderCard = Color(0xFF453657);
const Color kBorderCopper = Color(0xFFC86D3B);
const Color kBorderCopperDim = Color(0xFF6D3A1D);
const Color kTextCream = Color(0xFFFAF2E3);
const Color kTextMain = Color(0xFFF5EEDF);
const Color kTextMuted = Color(0xFFAB9EB8);
const Color kTextDim = Color(0xFF7A6E88);
const Color kAccentCopper = Color(0xFFC86D3B);
const Color kAccentCopperLight = Color(0xFFDC7A42);
const Color kAccentGold = Color(0xFFFFCD75);
const Color kAccentAmber = Color(0xFFD97706);
const Color kAccentUrgentRose = Color(0xFFBE123C);
const Color kAccentUrgentBg = Color(0xFF2B0B14);
const Color kAccentSage = Color(0xFF2D6A4F);
const Color kAccentSageBg = Color(0xFF0F281D);

void main() => runApp(const HexleyPantryApp());

class HexleyPantryApp extends StatelessWidget {
  const HexleyPantryApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: "Hexley's Potion Pantry",
      debugShowCheckedModeBanner: false,
      theme: ThemeData.dark().copyWith(
        scaffoldBackgroundColor: kBgPrimary,
        cardColor: kBgCard,
        canvasColor: kBgSurface,
        dialogBackgroundColor: kBgCard,
        colorScheme: const ColorScheme.dark(
          primary: kAccentCopper,
          secondary: kAccentGold,
          surface: kBgSurface,
          background: kBgPrimary,
          error: kAccentUrgentRose,
        ),
        appBarTheme: const AppBarTheme(
          backgroundColor: kBgSurface,
          elevation: 0,
        ),
      ),
      home: const PantryMobileScreen(),
    );
  }
}

class PantryMobileScreen extends StatefulWidget {
  const PantryMobileScreen({super.key});

  @override
  State<PantryMobileScreen> createState() => _PantryMobileScreenState();
}

class _PantryMobileScreenState extends State<PantryMobileScreen> {
  // Default to detected local LAN IP of the host machine
  static const String detectedLanIp = "192.168.88.35";
  String serverBaseUrl = "http://192.168.88.35:8000";

  List pantry = [];
  bool isLoading = false;
  bool isConnected = false;
  String connectionMessage = "Consulting ledger...";

  @override
  void initState() {
    super.initState();
    testAndFetchPantry();
  }

  Future<void> testAndFetchPantry() async {
    setState(() {
      isLoading = true;
    });

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
        });
      } else {
        setState(() {
          isConnected = false;
          connectionMessage = "Error: HTTP ${res.statusCode}";
          isLoading = false;
        });
      }
    } catch (e) {
      setState(() {
        isConnected = false;
        connectionMessage = "Unreachable";
        isLoading = false;
      });
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
          content: Text("⚠️ Shelf audit reported: 5 units missing recorded"),
          backgroundColor: kAccentUrgentRose,
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
        backgroundColor: kBgCard,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(14),
          side: const BorderSide(color: kBorderCopperDim, width: 1.2),
        ),
        title: Row(
          children: const [
            Text("✦ ", style: TextStyle(color: kAccentCopper, fontSize: 18)),
            Text(
              "Add New Reagent",
              style: TextStyle(
                fontFamily: 'serif',
                fontSize: 17,
                fontWeight: FontWeight.bold,
                color: kTextCream,
              ),
            ),
          ],
        ),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: nameCtrl,
                style: const TextStyle(color: kTextCream, fontSize: 13),
                decoration: const InputDecoration(
                  labelText: "Ingredient Name",
                  labelStyle: TextStyle(color: kTextMuted, fontSize: 12),
                  hintText: "e.g. Phoenix Feather",
                  hintStyle: TextStyle(color: kTextDim, fontSize: 12),
                  enabledBorder: OutlineInputBorder(borderSide: BorderSide(color: kBorderSubtle)),
                  focusedBorder: OutlineInputBorder(borderSide: BorderSide(color: kBorderCopper)),
                  isDense: true,
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: stockCtrl,
                keyboardType: TextInputType.number,
                style: const TextStyle(color: kTextCream, fontSize: 13),
                decoration: const InputDecoration(
                  labelText: "Current Stock",
                  labelStyle: TextStyle(color: kTextMuted, fontSize: 12),
                  enabledBorder: OutlineInputBorder(borderSide: BorderSide(color: kBorderSubtle)),
                  focusedBorder: OutlineInputBorder(borderSide: BorderSide(color: kBorderCopper)),
                  isDense: true,
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: safetyCtrl,
                keyboardType: TextInputType.number,
                style: const TextStyle(color: kTextCream, fontSize: 13),
                decoration: const InputDecoration(
                  labelText: "Safety Stock Threshold",
                  labelStyle: TextStyle(color: kTextMuted, fontSize: 12),
                  enabledBorder: OutlineInputBorder(borderSide: BorderSide(color: kBorderSubtle)),
                  focusedBorder: OutlineInputBorder(borderSide: BorderSide(color: kBorderCopper)),
                  isDense: true,
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: supplierCtrl,
                style: const TextStyle(color: kTextCream, fontSize: 13),
                decoration: const InputDecoration(
                  labelText: "Supplier",
                  labelStyle: TextStyle(color: kTextMuted, fontSize: 12),
                  enabledBorder: OutlineInputBorder(borderSide: BorderSide(color: kBorderSubtle)),
                  focusedBorder: OutlineInputBorder(borderSide: BorderSide(color: kBorderCopper)),
                  isDense: true,
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: leadTimeCtrl,
                keyboardType: TextInputType.number,
                style: const TextStyle(color: kTextCream, fontSize: 13),
                decoration: const InputDecoration(
                  labelText: "Lead Time (Days)",
                  labelStyle: TextStyle(color: kTextMuted, fontSize: 12),
                  enabledBorder: OutlineInputBorder(borderSide: BorderSide(color: kBorderSubtle)),
                  focusedBorder: OutlineInputBorder(borderSide: BorderSide(color: kBorderCopper)),
                  isDense: true,
                ),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text("Cancel", style: TextStyle(color: kTextMuted)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: kAccentCopper,
              foregroundColor: kTextCream,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
            ),
            onPressed: () async {
              final name = nameCtrl.text.trim();
              if (name.isEmpty) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text("Please enter reagent name")),
                );
                return;
              }
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
      final res = await http.post(
        Uri.parse("$sanitizedBase/api/pantry"),
        headers: {"Content-Type": "application/json"},
        body: jsonEncode(payload),
      );
      if (res.statusCode == 200 || res.statusCode == 201) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text("✦ Registered ${payload['name']} into vault ledger!"),
            backgroundColor: kAccentSage,
          ),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text("Failed to add: HTTP ${res.statusCode}")),
        );
      }
      await testAndFetchPantry();
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text("Error adding reagent: $e")),
      );
      setState(() => isLoading = false);
    }
  }

  void openSettingsDialog() {
    final controller = TextEditingController(text: serverBaseUrl);
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: kBgCard,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(14),
          side: const BorderSide(color: kBorderCopperDim, width: 1.2),
        ),
        title: Row(
          children: const [
            Icon(Icons.tune_rounded, color: kAccentCopper, size: 20),
            SizedBox(width: 8),
            Text(
              "Vault Host Settings",
              style: TextStyle(fontFamily: 'serif', fontSize: 16, fontWeight: FontWeight.bold, color: kTextCream),
            ),
          ],
        ),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                "FastAPI server host address (include port 8000):",
                style: TextStyle(fontSize: 11.5, color: kTextMuted),
              ),
              const SizedBox(height: 8),
              TextField(
                controller: controller,
                style: const TextStyle(color: kTextCream, fontSize: 13, fontFamily: 'monospace'),
                decoration: const InputDecoration(
                  enabledBorder: OutlineInputBorder(borderSide: BorderSide(color: kBorderSubtle)),
                  focusedBorder: OutlineInputBorder(borderSide: BorderSide(color: kBorderCopper)),
                  hintText: "http://192.168.x.x:8000",
                  isDense: true,
                ),
              ),
              const SizedBox(height: 14),
              const Text(
                "Host Presets:",
                style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: kAccentCopperLight),
              ),
              const SizedBox(height: 6),
              Wrap(
                spacing: 6,
                runSpacing: 6,
                children: [
                  ActionChip(
                    backgroundColor: const Color(0xFF281838),
                    side: const BorderSide(color: kBorderSubtle),
                    label: const Text("Wi-Fi LAN (Laptop)", style: TextStyle(fontSize: 10.5, color: kTextCream)),
                    onPressed: () {
                      controller.text = "http://$detectedLanIp:8000";
                    },
                  ),
                  ActionChip(
                    backgroundColor: const Color(0xFF281838),
                    side: const BorderSide(color: kBorderSubtle),
                    label: const Text("Android Emulator (10.0.2.2)", style: TextStyle(fontSize: 10.5, color: kTextCream)),
                    onPressed: () {
                      controller.text = "http://10.0.2.2:8000";
                    },
                  ),
                  ActionChip(
                    backgroundColor: const Color(0xFF281838),
                    side: const BorderSide(color: kBorderSubtle),
                    label: const Text("Localhost", style: TextStyle(fontSize: 10.5, color: kTextCream)),
                    onPressed: () {
                      controller.text = "http://127.0.0.1:8000";
                    },
                  ),
                ],
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text("Cancel", style: TextStyle(color: kTextMuted)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: kAccentCopper,
              foregroundColor: kTextCream,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
            ),
            onPressed: () {
              setState(() {
                serverBaseUrl = controller.text.trim();
              });
              Navigator.pop(ctx);
              testAndFetchPantry();
            },
            child: const Text("Connect"),
          ),
        ],
      ),
    );
  }

  Widget _buildSummaryMetricsRow() {
    int outOfStock = 0;
    int lowStock = 0;
    int stockout7d = 0;
    final totalItems = pantry.length;

    for (final item in pantry) {
      final current = (item['current_stock'] as num?)?.toInt() ?? 0;
      final safety = (item['safety_stock'] as num?)?.toInt() ?? 0;
      final prophecy = item['prophecy'] as Map? ?? {};
      final days = (prophecy['days_until_run_out'] as num?)?.toDouble() ?? 999.0;

      if (current == 0) {
        outOfStock++;
      } else if (current < safety) {
        lowStock++;
      }

      if (days < 7.0) {
        stockout7d++;
      }
    }

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      child: Row(
        children: [
          _buildMetricTile(
            label: "OUT OF STOCK",
            sub: "DEFICIT",
            value: outOfStock.toString(),
            accentColor: const Color(0xFFF87171),
            bgColor: const Color(0xFF280B12),
          ),
          const SizedBox(width: 6),
          _buildMetricTile(
            label: "LOW STOCK",
            sub: "DEPLETING",
            value: lowStock.toString(),
            accentColor: const Color(0xFFFBBF24),
            bgColor: const Color(0xFF26190D),
          ),
          const SizedBox(width: 6),
          _buildMetricTile(
            label: "STOCKOUT < 7d",
            sub: "PROPHECY",
            value: stockout7d.toString(),
            accentColor: const Color(0xFFC084FC),
            bgColor: const Color(0xFF1E1229),
          ),
          const SizedBox(width: 6),
          _buildMetricTile(
            label: "CATALOGUED",
            sub: "VAULT",
            value: totalItems.toString(),
            accentColor: kAccentGold,
            bgColor: const Color(0xFF1B1425),
          ),
        ],
      ),
    );
  }

  Widget _buildMetricTile({
    required String label,
    required String sub,
    required String value,
    required Color accentColor,
    required Color bgColor,
  }) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 4),
        decoration: BoxDecoration(
          color: bgColor,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: accentColor.withOpacity(0.35), width: 1),
          boxShadow: const [
            BoxShadow(
              color: Colors.black26,
              blurRadius: 4,
              offset: Offset(0, 2),
            )
          ],
        ),
        child: Column(
          children: [
            Text(
              value,
              style: TextStyle(
                fontFamily: 'serif',
                fontSize: 15,
                fontWeight: FontWeight.w900,
                color: accentColor,
                height: 1.1,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              label,
              style: const TextStyle(
                fontSize: 7.5,
                fontWeight: FontWeight.w700,
                color: kTextMuted,
                letterSpacing: 0.3,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
            Text(
              sub,
              style: TextStyle(
                fontSize: 6.5,
                fontWeight: FontWeight.w800,
                color: accentColor.withOpacity(0.85),
                letterSpacing: 0.6,
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        backgroundColor: kBgSurface,
        elevation: 0,
        title: Row(
          children: [
            Container(
              width: 32,
              height: 32,
              decoration: BoxDecoration(
                color: const Color(0xFF241530),
                shape: BoxShape.circle,
                border: Border.all(color: kBorderCopper, width: 1.2),
              ),
              child: const Center(
                child: Text(
                  "⚗️",
                  style: TextStyle(fontSize: 16),
                ),
              ),
            ),
            const SizedBox(width: 9),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: const [
                Text(
                  "HEXLEY'S PANTRY",
                  style: TextStyle(
                    fontFamily: 'serif',
                    fontSize: 14.5,
                    fontWeight: FontWeight.w900,
                    color: kTextCream,
                    letterSpacing: 1.2,
                  ),
                ),
                Text(
                  "EST. 1888 • VAULT LEDGER",
                  style: TextStyle(
                    fontSize: 8.5,
                    fontWeight: FontWeight.w700,
                    color: kAccentCopperLight,
                    letterSpacing: 1.0,
                  ),
                ),
              ],
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.tune_rounded, size: 20, color: kTextCream),
            tooltip: "Server Host Settings",
            onPressed: openSettingsDialog,
          ),
          IconButton(
            icon: const Icon(Icons.refresh_rounded, size: 20, color: kTextCream),
            tooltip: "Refresh Ledger",
            onPressed: testAndFetchPantry,
          ),
        ],
      ),
      body: Column(
        children: [
          // Victorian Telemetry Strip
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
            decoration: const BoxDecoration(
              color: Color(0xFF140D1C),
              border: Border(
                bottom: BorderSide(color: kBorderSubtle, width: 1),
              ),
            ),
            child: Row(
              children: [
                Icon(
                  Icons.circle,
                  size: 9,
                  color: isConnected ? const Color(0xFF34D399) : kAccentUrgentRose,
                ),
                const SizedBox(width: 8),
                Text(
                  isConnected ? "Vault Ledger Synchronized" : "Vault Disconnected",
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: isConnected ? kTextCream : const Color(0xFFFCA5A5),
                  ),
                ),
                const SizedBox(width: 6),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                  decoration: BoxDecoration(
                    color: Colors.black45,
                    borderRadius: BorderRadius.circular(4),
                    border: Border.all(color: kBorderSubtle, width: 0.8),
                  ),
                  child: Text(
                    ":" + (serverBaseUrl.split(":").last),
                    style: const TextStyle(
                      fontSize: 9,
                      fontFamily: 'monospace',
                      color: Color(0xFF6EE7B7),
                    ),
                  ),
                ),
                const Spacer(),
                InkWell(
                  onTap: openSettingsDialog,
                  borderRadius: BorderRadius.circular(4),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      border: Border.all(color: kBorderCopperDim, width: 1),
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: const Text(
                      "SWITCH IP",
                      style: TextStyle(
                        fontSize: 9.5,
                        fontWeight: FontWeight.w800,
                        color: kAccentCopper,
                        letterSpacing: 0.5,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),

          // Main Inventory Scroll Area
          Expanded(
            child: RefreshIndicator(
              color: kAccentCopper,
              backgroundColor: kBgSurface,
              onRefresh: testAndFetchPantry,
              child: ListView(
                padding: const EdgeInsets.only(bottom: 90),
                children: [
                  // Full Moon Lunar Curse Hero Plate (Matching Web Master Banner)
                  Container(
                    margin: const EdgeInsets.fromLTRB(12, 12, 12, 8),
                    padding: const EdgeInsets.all(13),
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                        colors: [
                          Color(0xFF28131B),
                          Color(0xFF160E1A),
                        ],
                      ),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: kBorderCopperDim, width: 1.2),
                      boxShadow: const [
                        BoxShadow(
                          color: Colors.black54,
                          blurRadius: 10,
                          offset: Offset(0, 4),
                        ),
                      ],
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Row(
                              children: const [
                                Text(
                                  "☾ ",
                                  style: TextStyle(fontSize: 13, color: kAccentGold),
                                ),
                                Text(
                                  "APOTHECARY DIRECTIVE • VOL. IV",
                                  style: TextStyle(
                                    fontSize: 9,
                                    fontWeight: FontWeight.w800,
                                    color: kAccentCopper,
                                    letterSpacing: 1.0,
                                  ),
                                ),
                              ],
                            ),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(
                                color: kAccentCopper.withOpacity(0.18),
                                border: Border.all(color: kBorderCopper, width: 0.8),
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: const Text(
                                "MANDATE ACTIVE",
                                style: TextStyle(
                                  fontSize: 8,
                                  fontWeight: FontWeight.w800,
                                  color: kAccentGold,
                                  letterSpacing: 0.8,
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 7),
                        const Text(
                          "Full Moon Festival Approaching",
                          style: TextStyle(
                            fontFamily: 'serif',
                            fontSize: 15,
                            fontWeight: FontWeight.bold,
                            color: kTextCream,
                            letterSpacing: 0.3,
                          ),
                        ),
                        const SizedBox(height: 4),
                        const Text(
                          "Celestial lunar tides trigger the Midnight Curse: demand triples across three vital apothecary ingredients.",
                          style: TextStyle(
                            fontSize: 10.5,
                            color: kTextMuted,
                            height: 1.35,
                          ),
                        ),
                        const SizedBox(height: 9),
                        Wrap(
                          spacing: 6,
                          runSpacing: 6,
                          children: [
                            _buildCursedPill("☾ Bat Wings"),
                            _buildCursedPill("☾ Mandrake Root"),
                            _buildCursedPill("☾ Newt Eyes"),
                          ],
                        ),
                      ],
                    ),
                  ),

                  // 4 Summary Metrics (Matching Web Dashboard)
                  _buildSummaryMetricsRow(),

                  const SizedBox(height: 4),

                  // Empty / Loading / List State
                  if (isLoading && pantry.isEmpty)
                    const Padding(
                      padding: EdgeInsets.symmetric(vertical: 50),
                      child: Center(
                        child: CircularProgressIndicator(color: kAccentCopper),
                      ),
                    )
                  else if (pantry.isEmpty)
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 50, horizontal: 20),
                      child: Center(
                        child: Column(
                          children: [
                            const Icon(Icons.cloud_off, size: 44, color: kTextDim),
                            const SizedBox(height: 12),
                            Text(
                              isConnected ? "No reagents found in vault ledger" : "Cannot reach backend server",
                              style: const TextStyle(fontSize: 14, color: kTextMuted, fontFamily: 'serif'),
                            ),
                            const SizedBox(height: 12),
                            ElevatedButton.icon(
                              style: ElevatedButton.styleFrom(
                                backgroundColor: kAccentCopper,
                                foregroundColor: kTextCream,
                              ),
                              onPressed: openSettingsDialog,
                              icon: const Icon(Icons.tune_rounded, size: 16),
                              label: const Text("Configure Host IP"),
                            ),
                          ],
                        ),
                      ),
                    )
                  else
                    for (var item in pantry) _buildPantryItemCard(item),
                ],
              ),
            ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: kAccentCopper,
        foregroundColor: kTextCream,
        elevation: 4,
        icon: const Icon(Icons.add, color: kAccentGold, size: 18),
        label: const Text(
          "Add Ingredient",
          style: TextStyle(
            fontFamily: 'serif',
            fontWeight: FontWeight.w800,
            letterSpacing: 0.6,
            fontSize: 12.5,
          ),
        ),
        onPressed: openAddIngredientDialog,
      ),
    );
  }

  Widget _buildCursedPill(String label) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
      decoration: BoxDecoration(
        color: kAccentCopper.withOpacity(0.15),
        border: Border.all(color: kBorderCopper, width: 0.9),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(
        label,
        style: const TextStyle(
          fontSize: 10,
          fontWeight: FontWeight.w700,
          color: kAccentGold,
        ),
      ),
    );
  }

  Widget _buildPantryItemCard(dynamic item) {
    final anomalies = (item['anomalies'] as List?) ?? [];
    final isCursed = item['is_cursed'] == true;
    final currentStock = item['current_stock'] ?? 0;
    final expectedStock = item['expected_stock'] ?? currentStock;
    final safetyStock = item['safety_stock'] ?? 0;
    final prophecy = item['prophecy'] ?? {};
    final burn = prophecy['daily_burn_rate'] ?? 0;
    final runOut = prophecy['days_until_run_out'] ?? 'N/A';
    final reorder = prophecy['recommended_reorder'] ?? 0;
    final category = item['category'] ?? "Apothecary Reagent";

    final missingAlerts = anomalies
        .where((a) => a is Map && a['type'] == 'MISSING_STOCK')
        .toList();
    final spikeAlerts = anomalies
        .where((a) => a is Map && a['type'] != 'MISSING_STOCK')
        .toList();

    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      color: kBgCard,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(10),
        side: BorderSide(
          color: isCursed ? kBorderCopper : kBorderCard,
          width: isCursed ? 1.4 : 1.0,
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.all(13),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Card Header Row: Title & Badge
            Row(
              mainAxisAlignment: MainAxisAlignment.between,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Text(
                    "${item['name']}",
                    style: const TextStyle(
                      fontFamily: 'serif',
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      color: kTextCream,
                      letterSpacing: 0.2,
                    ),
                  ),
                ),
                if (isCursed)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2.5),
                    decoration: BoxDecoration(
                      color: kAccentCopper.withOpacity(0.2),
                      border: Border.all(color: kBorderCopper, width: 0.9),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Text(
                      "☾ 3x SURGE",
                      style: TextStyle(
                        fontSize: 9.5,
                        fontWeight: FontWeight.w800,
                        color: kAccentGold,
                        letterSpacing: 0.6,
                      ),
                    ),
                  )
                else
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: Colors.white.withOpacity(0.04),
                      border: Border.all(color: kBorderSubtle, width: 0.8),
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Text(
                      category,
                      style: const TextStyle(
                        fontSize: 9,
                        fontWeight: FontWeight.w600,
                        color: kTextMuted,
                      ),
                    ),
                  ),
              ],
            ),

            const SizedBox(height: 10),

            // 3-Column Metrics Grid (Matching Web Dashboard)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
              decoration: BoxDecoration(
                color: const Color(0xFF130C1C),
                borderRadius: BorderRadius.circular(6),
                border: Border.all(color: kBorderSubtle, width: 0.8),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          "CURRENT STOCK",
                          style: TextStyle(
                            fontSize: 8,
                            fontWeight: FontWeight.w700,
                            color: kTextDim,
                            letterSpacing: 0.6,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          "$currentStock",
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w900,
                            color: currentStock < safetyStock ? const Color(0xFFF87171) : const Color(0xFF34D399),
                          ),
                        ),
                      ],
                    ),
                  ),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          "EXPECTED",
                          style: TextStyle(
                            fontSize: 8,
                            fontWeight: FontWeight.w700,
                            color: kTextDim,
                            letterSpacing: 0.6,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          "$expectedStock",
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w900,
                            color: kTextCream,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          "BURN RATE",
                          style: TextStyle(
                            fontSize: 8,
                            fontWeight: FontWeight.w700,
                            color: kTextDim,
                            letterSpacing: 0.6,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          "${burn}/day",
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w900,
                            color: kAccentCopperLight,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 8),

            // Reorder Prescription Row
            Row(
              children: [
                Text(
                  "Run out: ${runOut}d",
                  style: const TextStyle(fontSize: 11, color: kTextMuted),
                ),
                const SizedBox(width: 6),
                const Text("•", style: TextStyle(color: kTextDim, fontSize: 11)),
                const SizedBox(width: 6),
                const Text(
                  "Reorder: ",
                  style: TextStyle(fontSize: 11, color: kTextMuted),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                  decoration: BoxDecoration(
                    color: kAccentCopper.withOpacity(0.15),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(
                    "$reorder units",
                    style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                      color: kAccentGold,
                    ),
                  ),
                ),
              ],
            ),

            // Anomaly 1: Missing Stock / Shrinkage Box
            if (missingAlerts.isNotEmpty) ...[
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                decoration: BoxDecoration(
                  color: kAccentUrgentBg,
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(color: kAccentUrgentRose, width: 1),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text("🚨 ", style: TextStyle(fontSize: 14)),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            "VAULT SHRINKAGE DETECTED",
                            style: TextStyle(
                              fontSize: 10.5,
                              fontWeight: FontWeight.w800,
                              color: Color(0xFFFCA5A5),
                              letterSpacing: 0.5,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            "${(missingAlerts.first['missing_units'] ?? (expectedStock - currentStock).clamp(1, 9999))} units missing from shelf without sales record!",
                            style: const TextStyle(fontSize: 10.5, color: kTextCream),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ],

            // Anomaly 2: Demand Spikes (Collapsible Drawer to eliminate UI clutter)
            if (spikeAlerts.length == 1) ...[
              const SizedBox(height: 7),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
                decoration: BoxDecoration(
                  color: const Color(0xFF24141E),
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(color: kBorderCopperDim, width: 0.9),
                ),
                child: Row(
                  children: [
                    const Text("⚡ ", style: TextStyle(fontSize: 13, color: kAccentCopper)),
                    Expanded(
                      child: Text(
                        "Demand Surge on ${spikeAlerts.first['date']}: ${spikeAlerts.first['qty']} units (+${spikeAlerts.first['z_score']}σ)",
                        style: const TextStyle(fontSize: 10.5, color: Color(0xFFFCA5A5), fontWeight: FontWeight.w600),
                      ),
                    ),
                  ],
                ),
              ),
            ] else if (spikeAlerts.length > 1) ...[
              const SizedBox(height: 7),
              Container(
                decoration: BoxDecoration(
                  color: const Color(0xFF24141E),
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(color: kBorderCopperDim, width: 0.9),
                ),
                child: Theme(
                  data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
                  child: ExpansionTile(
                    dense: true,
                    visualDensity: VisualDensity.compact,
                    tilePadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 0),
                    childrenPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    leading: const Text("⚡", style: TextStyle(fontSize: 13, color: kAccentCopper)),
                    title: Text(
                      "${spikeAlerts.length} Historical Spikes Detected",
                      style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFFFECACA)),
                    ),
                    subtitle: Text(
                      "Peak: +" +
                          spikeAlerts
                              .map((s) => (s['z_score'] as num?)?.toDouble() ?? 0.0)
                              .reduce((a, b) => a > b ? a : b)
                              .toString() +
                          "σ (${spikeAlerts.first['date']})",
                      style: const TextStyle(fontSize: 9.5, color: kAccentCopperLight),
                    ),
                    children: [
                      for (var s in spikeAlerts)
                        Padding(
                          padding: const EdgeInsets.symmetric(vertical: 2.5),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.between,
                            children: [
                              Text(
                                s['date'].toString(),
                                style: const TextStyle(fontSize: 10.5, fontFamily: 'monospace', color: Colors.white70),
                              ),
                              Text(
                                "${s['qty']} units (+${s['z_score']}σ)",
                                style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.bold, color: Color(0xFFFCA5A5)),
                              ),
                            ],
                          ),
                        ),
                    ],
                  ),
                ),
              ),
            ],

            const SizedBox(height: 10),

            // Bottom Action: Victorian Audit Shelf Button
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                style: OutlinedButton.styleFrom(
                  backgroundColor: kAccentUrgentBg,
                  foregroundColor: const Color(0xFFFCA5A5),
                  side: const BorderSide(color: kBorderCopperDim, width: 0.8),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(6),
                  ),
                  padding: const EdgeInsets.symmetric(vertical: 8),
                ),
                onPressed: () => reportMissingStock(item['id']),
                icon: const Icon(Icons.warning_amber_rounded, size: 14, color: Color(0xFFF87171)),
                label: const Text(
                  "Audit Shelf (Report Shrinkage)",
                  style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
