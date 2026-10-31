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
  final String apiUrl = "http://10.0.2.2:8000/api/pantry";

  Future<void> fetchPantry() async {
    final res = await http.get(Uri.parse(apiUrl));
    if (res.statusCode == 200) {
      setState(() => pantry = jsonDecode(res.body)['pantry']);
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
            return Card(
              margin: const EdgeInsets.all(8),
              child: ListTile(
                title: Text("${item['name']} (Stock: ${item['current_stock']})"),
                subtitle: Text(
                  "Run out: ${item['prophecy']['days_until_run_out']}d | Reorder: ${item['prophecy']['recommended_reorder']}",
                ),
              ),
            );
          },
        ),
      ),
    );
  }
}
