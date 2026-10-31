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
      theme: ThemeData.dark(),
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
  List pantry = [];
  // 10.0.2.2 points Android Emulator to host localhost:8000
  final String baseUrl = "http://10.0.2.2:8000/api";

  Future<void> fetchPantry() async {
    try {
      final res = await http.get(Uri.parse("$baseUrl/pantry"));
      if (res.statusCode == 200) {
        setState(() => pantry = jsonDecode(res.body)['pantry']);
      }
    } catch (e) {
      debugPrint("Error fetching pantry: $e");
    }
  }

  Future<void> reportMissingStock(int itemId) async {
    try {
      await http.post(
        Uri.parse("$baseUrl/pantry/$itemId/audit"),
        headers: {"Content-Type": "application/json"},
        body: jsonEncode({"missing_amount": 5}),
      );
      await fetchPantry();
    } catch (e) {
      debugPrint("Error reporting missing stock: $e");
    }
  }

  @override
  void initState() {
    super.initState();
    fetchPantry();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text("🎃 Witch's Pantry Mobile")),
      body: RefreshIndicator(
        onRefresh: fetchPantry,
        child: ListView.builder(
          itemCount: pantry.length,
          itemBuilder: (context, i) {
            final item = pantry[i];
            final anomalies = (item['anomalies'] as List?) ?? [];
            return Card(
              margin: const EdgeInsets.all(8),
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      "${item['name']} (Stock: ${item['current_stock']})",
                      style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      "Run out: ${item['prophecy']['days_until_run_out']}d | Reorder: ${item['prophecy']['recommended_reorder']}",
                    ),
                    if (anomalies.isNotEmpty) ...[
                      const SizedBox(height: 6),
                      for (var alert in anomalies)
                        Container(
                          padding: const EdgeInsets.all(4),
                          margin: const EdgeInsets.only(top: 2),
                          decoration: BoxDecoration(
                            color: Colors.red[900],
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(
                            "⚠️ $alert",
                            style: const TextStyle(fontSize: 12),
                          ),
                        ),
                    ],
                    const SizedBox(height: 8),
                    ElevatedButton.icon(
                      style: ElevatedButton.styleFrom(backgroundColor: Colors.redAccent),
                      onPressed: () => reportMissingStock(item['id']),
                      icon: const Icon(Icons.warning, size: 16),
                      label: const Text("Audit Shelf (Report Missing Stock)"),
                    ),
                  ],
                ),
              ),
            );
          },
        ),
      ),
    );
  }
}
