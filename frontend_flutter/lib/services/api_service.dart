import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../models/models.dart';

class ApiService {
  // 10.0.2.2 is the localhost loopback alias in Android Emulator.
  // For physical devices or local testing, can be adjusted or configured.
  static const String baseUrl = 'http://10.0.2.2:5000/api';

  static Future<String?> getToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString('jwt_token');
  }

  static Future<void> setSession(String token, UserModel user) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('jwt_token', token);
    await prefs.setString('user_role', user.role);
    await prefs.setString('user_name', user.fullName);
    await prefs.setString('user_email', user.email);
  }

  static Future<void> clearSession() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.clear();
  }

  static Future<Map<String, String>> _headers() async {
    final token = await getToken();
    return {
      'Content-Type': 'application/json',
      if (token != null) 'Authorization': 'Bearer $token',
    };
  }

  // Auth: Login
  static Future<UserModel> login(String email, String password) async {
    final response = await http.post(
      Uri.parse('$baseUrl/auth/login'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'email': email, 'password': password}),
    );

    final data = jsonDecode(response.body);
    if (response.statusCode == 200 && data['success'] == true) {
      final user = UserModel.fromJson(data['user']);
      await setSession(data['token'], user);
      return user;
    } else {
      throw Exception(data['message'] ?? 'Login failed');
    }
  }

  // Dashboard Summary
  static Future<DashboardSummaryModel> getDashboardSummary() async {
    final headers = await _headers();
    final res = await http.get(Uri.parse('$baseUrl/reports/dashboard-summary'), headers: headers);
    final data = jsonDecode(res.body);
    if (res.statusCode == 200 && data['success'] == true) {
      return DashboardSummaryModel.fromJson(data['data']);
    }
    throw Exception(data['message'] ?? 'Failed to load dashboard');
  }

  // Projects
  static Future<List<ProjectModel>> getProjects() async {
    final headers = await _headers();
    final res = await http.get(Uri.parse('$baseUrl/projects'), headers: headers);
    final data = jsonDecode(res.body);
    if (res.statusCode == 200 && data['success'] == true) {
      final list = (data['data'] as List).map((p) => ProjectModel.fromJson(p)).toList();
      return list;
    }
    throw Exception(data['message'] ?? 'Failed to load projects');
  }

  // Expenses
  static Future<List<ExpenseModel>> getExpenses() async {
    final headers = await _headers();
    final res = await http.get(Uri.parse('$baseUrl/expenses'), headers: headers);
    final data = jsonDecode(res.body);
    if (res.statusCode == 200 && data['success'] == true) {
      final list = (data['data'] as List).map((e) => ExpenseModel.fromJson(e)).toList();
      return list;
    }
    throw Exception(data['message'] ?? 'Failed to load expenses');
  }

  // Income
  static Future<List<IncomeModel>> getIncomeTransactions() async {
    final headers = await _headers();
    final res = await http.get(Uri.parse('$baseUrl/income'), headers: headers);
    final data = jsonDecode(res.body);
    if (res.statusCode == 200 && data['success'] == true) {
      final list = (data['data'] as List).map((i) => IncomeModel.fromJson(i)).toList();
      return list;
    }
    throw Exception(data['message'] ?? 'Failed to load income');
  }

  // Invoices
  static Future<List<InvoiceModel>> getInvoices() async {
    final headers = await _headers();
    final res = await http.get(Uri.parse('$baseUrl/invoices'), headers: headers);
    final data = jsonDecode(res.body);
    if (res.statusCode == 200 && data['success'] == true) {
      final list = (data['data'] as List).map((inv) => InvoiceModel.fromJson(inv)).toList();
      return list;
    }
    throw Exception(data['message'] ?? 'Failed to load invoices');
  }
}
