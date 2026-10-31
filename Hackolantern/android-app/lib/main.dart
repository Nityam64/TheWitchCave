import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

void main() => runApp(const WitchPantryApp());

class WitchPantryApp extends StatelessWidget {
  const WitchPantryApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: "Witch's Potion Pantry",
      debugShowCheckedModeBanner: false,
      theme: ThemeData.dark().copyWith(
        scaffoldBackgroundColor: const Color(0xFF0F0817),
        cardColor: const Color(0xFF1B112C),
        colorScheme: const ColorScheme.dark(
          primary: Color(0xFF9333EA),
          secondary: Color(0xFF10B981),
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
  String connectionMessage = "Connecting...";

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
          connectionMessage = "Connected (HTTP 200)";
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
        connectionMessage = "Unreachable (${e.runtimeType})";
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
          content: Text("⚠️ Shelf audit reported: 5 units missing"),
          backgroundColor: Colors.redAccent,
        ),
      );
      await testAndFetchPantry();
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text("Failed to report: $e")),
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
        backgroundColor: const Color(0xFF1B112C),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Row(
          children: [
            Icon(Icons.add_circle, color: Color(0xFF10B981)),
            SizedBox(width: 8),
            Text("Add New Ingredient", style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
          ],
        ),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: nameCtrl,
                decoration: const InputDecoration(
                  labelText: "Ingredient Name",
                  hintText: "e.g. Phoenix Feather",
                  border: OutlineInputBorder(),
                  isDense: true,
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: stockCtrl,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(
                  labelText: "Current Stock",
                  border: OutlineInputBorder(),
                  isDense: true,
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: safetyCtrl,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(
                  labelText: "Safety Stock Threshold",
                  border: OutlineInputBorder(),
                  isDense: true,
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: supplierCtrl,
                decoration: const InputDecoration(
                  labelText: "Supplier",
                  border: OutlineInputBorder(),
                  isDense: true,
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: leadTimeCtrl,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(
                  labelText: "Lead Time (Days)",
                  border: OutlineInputBorder(),
                  isDense: true,
                ),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text("Cancel"),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF10B981)),
            onPressed: () async {
              final name = nameCtrl.text.trim();
              if (name.isEmpty) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text("Please enter ingredient name")),
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
            child: const Text("Add to Pantry", style: TextStyle(color: Colors.white)),
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
            content: Text("✨ Successfully added ${payload['name']} to pantry!"),
            backgroundColor: const Color(0xFF10B981),
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
        SnackBar(content: Text("Error adding ingredient: $e")),
      );
      setState(() => isLoading = false);
    }
  }

  void openSettingsDialog() {
    final controller = TextEditingController(text: serverBaseUrl);
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF1B112C),
        title: const Row(
          children: [
            Icon(Icons.settings, color: Color(0xFF9333EA)),
            SizedBox(width: 8),
            Text("Server URL / IP Settings"),
          ],
        ),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                "Enter your FastAPI host address (include port 8000):",
                style: TextStyle(fontSize: 12, color: Colors.grey),
              ),
              const SizedBox(height: 8),
              TextField(
                controller: controller,
                decoration: const InputDecoration(
                  border: OutlineInputBorder(),
                  hintText: "http://192.168.x.x:8000",
                  isDense: true,
                ),
              ),
              const SizedBox(height: 16),
              const Text(
                "Quick Switch Presets:",
                style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 6),
              Wrap(
                spacing: 6,
                runSpacing: 6,
                children: [
                  ActionChip(
                    backgroundColor: const Color(0xFF2E1A4D),
                    label: const Text("Wi-Fi LAN (Laptop)", style: TextStyle(fontSize: 11)),
                    onPressed: () {
                      controller.text = "http://$detectedLanIp:8000";
                    },
                  ),
                  ActionChip(
                    backgroundColor: const Color(0xFF2E1A4D),
                    label: const Text("Android Emulator (10.0.2.2)", style: TextStyle(fontSize: 11)),
                    onPressed: () {
                      controller.text = "http://10.0.2.2:8000";
                    },
                  ),
                  ActionChip(
                    backgroundColor: const Color(0xFF2E1A4D),
                    label: const Text("Localhost", style: TextStyle(fontSize: 11)),
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
            child: const Text("Cancel"),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF9333EA)),
            onPressed: () {
              setState(() {
                serverBaseUrl = controller.text.trim();
              });
              Navigator.pop(ctx);
              testAndFetchPantry();
            },
            child: const Text("Apply & Connect"),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        backgroundColor: const Color(0xFF180E28),
        title: const Row(
          children: [
            Text("🧪 ", style: TextStyle(fontSize: 20)),
            Text("Witch Pantry Scanner", style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.settings),
            tooltip: "Server URL Settings",
            onPressed: openSettingsDialog,
          ),
          IconButton(
            icon: const Icon(Icons.refresh),
            tooltip: "Refresh Telemetry",
            onPressed: testAndFetchPantry,
          ),
        ],
      ),
      body: Column(
        children: [
          // Connection Status Strip
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
            decoration: BoxDecoration(
              color: isConnected ? const Color(0xFF064E3B) : const Color(0xFF7F1D1D),
              border: Border(
                bottom: BorderSide(
                  color: isConnected ? const Color(0xFF10B981) : const Color(0xFFEF4444),
                  width: 1,
                ),
              ),
            ),
            child: Row(
              children: [
                Icon(
                  isConnected ? Icons.check_circle : Icons.error,
                  size: 15,
                  color: isConnected ? Colors.greenAccent : Colors.redAccent,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Row(
                    children: [
                      Text(
                        isConnected ? "Connected" : "Disconnected",
                        style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
                      ),
                      const SizedBox(width: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                        decoration: BoxDecoration(
                          color: Colors.black38,
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          serverBaseUrl.replaceFirst(RegExp(r'^https?:\/\/'), ''),
                          style: const TextStyle(fontSize: 10, fontFamily: 'monospace', color: Colors.white70),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                ),
                GestureDetector(
                  onTap: openSettingsDialog,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: Colors.black38,
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: const Text(
                      "Switch IP",
                      style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold),
                    ),
                  ),
                ),
              ],
            ),
          ),

          // Main Inventory List
          Expanded(
            child: RefreshIndicator(
              onRefresh: testAndFetchPantry,
              child: isLoading
                  ? const Center(child: CircularProgressIndicator())
                  : pantry.isEmpty
                      ? ListView(
                          children: [
                            const SizedBox(height: 60),
                            Center(
                              child: Column(
                                children: [
                                  const Icon(Icons.cloud_off, size: 48, color: Colors.grey),
                                  const SizedBox(height: 12),
                                  Text(
                                    isConnected ? "No ingredients found in pantry" : "Cannot reach backend server",
                                    style: const TextStyle(fontSize: 16, color: Colors.grey),
                                  ),
                                  const SizedBox(height: 12),
                                  ElevatedButton.icon(
                                    style: ElevatedButton.styleFrom(
                                      backgroundColor: const Color(0xFF9333EA),
                                    ),
                                    onPressed: openSettingsDialog,
                                    icon: const Icon(Icons.settings),
                                    label: const Text("Configure Host IP"),
                                  ),
                                ],
                              ),
                            )
                          ],
                        )
                      : ListView.builder(
                          itemCount: pantry.length,
                          itemBuilder: (context, i) {
                            final item = pantry[i];
                            final anomalies = (item['anomalies'] as List?) ?? [];
                            final isCursed = item['is_cursed'] == true;
                            final currentStock = item['current_stock'] ?? 0;
                            final expectedStock = item['expected_stock'] ?? currentStock;
                            final prophecy = item['prophecy'] ?? {};

                            return Card(
                              margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(12),
                                side: BorderSide(
                                  color: isCursed ? Colors.amber : const Color(0xFF2E1A4D),
                                  width: isCursed ? 1.5 : 1,
                                ),
                              ),
                              child: Padding(
                                padding: const EdgeInsets.all(14),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      mainAxisAlignment: MainAxisAlignment.between,
                                      children: [
                                        Expanded(
                                          child: Text(
                                            "${item['name']}",
                                            style: const TextStyle(
                                              fontSize: 17,
                                              fontWeight: FontWeight.bold,
                                            ),
                                          ),
                                        ),
                                        if (isCursed)
                                          Container(
                                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                            decoration: BoxDecoration(
                                              color: Colors.amber.withOpacity(0.2),
                                              border: Border.all(color: Colors.amber),
                                              borderRadius: BorderRadius.circular(12),
                                            ),
                                            child: const Text(
                                              "🌕 3x CURSED",
                                              style: TextStyle(
                                                fontSize: 11,
                                                color: Colors.amber,
                                                fontWeight: FontWeight.bold,
                                              ),
                                            ),
                                          ),
                                      ],
                                    ),
                                    const SizedBox(height: 8),
                                    Row(
                                      children: [
                                        Text(
                                          "Stock: $currentStock",
                                          style: TextStyle(
                                            fontSize: 14,
                                            fontWeight: FontWeight.bold,
                                            color: currentStock < (item['safety_stock'] ?? 0)
                                                ? Colors.redAccent
                                                : Colors.greenAccent,
                                          ),
                                        ),
                                        const SizedBox(width: 8),
                                        Text(
                                          "/ Expected: $expectedStock",
                                          style: const TextStyle(fontSize: 12, color: Colors.grey),
                                        ),
                                        const Spacer(),
                                        Text(
                                          "Burn: ${prophecy['daily_burn_rate'] ?? 0}/day",
                                          style: const TextStyle(fontSize: 13, color: Colors.purpleAccent),
                                        ),
                                      ],
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      "Run out: ${prophecy['days_until_run_out'] ?? 'N/A'}d • Reorder: ${prophecy['recommended_reorder'] ?? 0} units",
                                      style: const TextStyle(fontSize: 12, color: Colors.white70),
                                    ),
                                    if (anomalies.isNotEmpty) ...[
                                      const SizedBox(height: 8),
                                      Builder(
                                        builder: (context) {
                                          final missingAlerts = anomalies
                                              .where((a) => a is Map && a['type'] == 'MISSING_STOCK')
                                              .toList();
                                          final spikeAlerts = anomalies
                                              .where((a) => a is Map && a['type'] != 'MISSING_STOCK')
                                              .toList();

                                          return Column(
                                            children: [
                                              if (missingAlerts.isNotEmpty)
                                                Container(
                                                  margin: const EdgeInsets.only(top: 6),
                                                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
                                                  decoration: BoxDecoration(
                                                    color: const Color(0xFF7F1D1D),
                                                    borderRadius: BorderRadius.circular(8),
                                                    border: Border.all(color: const Color(0xFFEF4444)),
                                                  ),
                                                  child: Row(
                                                    children: [
                                                      const Text("🚨 ", style: TextStyle(fontSize: 14)),
                                                      Expanded(
                                                        child: Text(
                                                          missingAlerts.first['message'] ?? "Missing stock detected on shelf audit",
                                                          style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.white),
                                                        ),
                                                      ),
                                                    ],
                                                  ),
                                                ),
                                              if (spikeAlerts.length == 1)
                                                Container(
                                                  margin: const EdgeInsets.only(top: 6),
                                                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
                                                  decoration: BoxDecoration(
                                                    color: const Color(0xFF281024),
                                                    borderRadius: BorderRadius.circular(8),
                                                    border: Border.all(color: const Color(0xFF991B1B)),
                                                  ),
                                                  child: Row(
                                                    children: [
                                                      const Text("⚡ ", style: TextStyle(fontSize: 14)),
                                                      Expanded(
                                                        child: Text(
                                                          "Spike on " + spikeAlerts.first['date'].toString() + ": " + spikeAlerts.first['qty'].toString() + " units (+" + spikeAlerts.first['z_score'].toString() + "σ)",
                                                          style: const TextStyle(fontSize: 11, color: Color(0xFFFCA5A5)),
                                                        ),
                                                      ),
                                                    ],
                                                  ),
                                                ),
                                              if (spikeAlerts.length > 1)
                                                Container(
                                                  margin: const EdgeInsets.only(top: 6),
                                                  decoration: BoxDecoration(
                                                    color: const Color(0xFF281024),
                                                    borderRadius: BorderRadius.circular(8),
                                                    border: Border.all(color: const Color(0xFF7F1D1D)),
                                                  ),
                                                  child: Theme(
                                                    data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
                                                    child: ExpansionTile(
                                                      dense: true,
                                                      visualDensity: VisualDensity.compact,
                                                      tilePadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 0),
                                                      childrenPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                                      leading: const Text("⚡", style: TextStyle(fontSize: 14)),
                                                      title: Text(
                                                        spikeAlerts.length.toString() + " Historical Spikes Detected",
                                                        style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFFFECACA)),
                                                      ),
                                                      subtitle: Text(
                                                        "Peak: +" + spikeAlerts.map((s) => (s['z_score'] as num?)?.toDouble() ?? 0.0).reduce((a, b) => a > b ? a : b).toString() + "σ (" + spikeAlerts.first['date'].toString() + ")",
                                                        style: const TextStyle(fontSize: 10, color: Color(0xFFFCA5A5)),
                                                      ),
                                                      children: [
                                                        for (var s in spikeAlerts)
                                                          Padding(
                                                            padding: const EdgeInsets.symmetric(vertical: 2),
                                                            child: Row(
                                                              mainAxisAlignment: MainAxisAlignment.between,
                                                              children: [
                                                                Text(
                                                                  s['date'].toString(),
                                                                  style: const TextStyle(fontSize: 11, fontFamily: 'monospace', color: Colors.white70),
                                                                ),
                                                                Text(
                                                                  s['qty'].toString() + " units (+" + s['z_score'].toString() + "σ)",
                                                                  style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFFFCA5A5)),
                                                                ),
                                                              ],
                                                            ),
                                                          ),
                                                      ],
                                                    ),
                                                  ),
                                                ),
                                            ],
                                          );
                                        },
                                      ),
                                    ]
const SizedBox(height: 10),
                                    SizedBox(
                                      width: double.infinity,
                                      child: ElevatedButton.icon(
                                        style: ElevatedButton.styleFrom(
                                          backgroundColor: const Color(0xFF991B1B),
                                          foregroundColor: Colors.white,
                                          shape: RoundedRectangleBorder(
                                            borderRadius: BorderRadius.circular(8),
                                          ),
                                        ),
                                        onPressed: () => reportMissingStock(item['id']),
                                        icon: const Icon(Icons.warning_amber_rounded, size: 16),
                                        label: const Text("Audit Shelf (Report Missing Stock)"),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            );
                          },
                        ),
            ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: const Color(0xFF10B981),
        foregroundColor: Colors.white,
        icon: const Icon(Icons.add),
        label: const Text("Add Ingredient", style: TextStyle(fontWeight: FontWeight.bold)),
        onPressed: openAddIngredientDialog,
      ),
    );
  }
}
