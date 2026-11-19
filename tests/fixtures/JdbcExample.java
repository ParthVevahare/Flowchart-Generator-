import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;

public class JdbcExample {
    private static final String URL = "jdbc:example:demo";
    private static final String USER = "example_user";
    private static final String PASSWORD = "example_password";

    public static void main(String[] args) {
        String insertSql = "INSERT INTO employees (name, role) VALUES (?, ?)";
        String selectSql = "SELECT id, name, role FROM employees";

        // Try-with-resources automatically closes connections and statements
        try (Connection conn = DriverManager.getConnection(URL, USER, PASSWORD);
             PreparedStatement pstmt = conn.prepareStatement(insertSql)) {

            // Insert a record
            pstmt.setString(1, "Example Employee");
            pstmt.setString(2, "Backend Engineer");
            pstmt.executeUpdate();

            // Retrieve records
            try (PreparedStatement selectStmt = conn.prepareStatement(selectSql);
                 ResultSet rs = selectStmt.executeQuery()) {
                while (rs.next()) {
                    System.out.printf("ID: %d | Name: %s | Role: %s%n",
                            rs.getInt("id"), rs.getString("name"), rs.getString("role"));
                }
            }
        } catch (SQLException e) {
            e.printStackTrace();
        }
    }
}
