async function sendResetCode(email, code) {

  try {

    const response = await resend.emails.send({
      from: 'HIBRID <no-reply@estuvia.org>',
      to: email,
      subject: 'Recuperación de contraseña - HIBRID',
      html: `
        <div style="font-family:Arial;background:#0f0f0f;padding:40px">

        <div style="max-width:500px;margin:auto;background:#1a1a1a;border-radius:10px;padding:30px;color:white">

            <h2 style="text-align:center;color:#B6FF00">
              HIBRID
            </h2>

            <p>Hola,</p>

            <p>Recibimos una solicitud para restablecer tu contraseña.</p>

            <p>Usa el siguiente código:</p>

            <div style="
              text-align:center;
              font-size:32px;
              letter-spacing:6px;
              font-weight:bold;
              margin:25px 0;
              color:#B6FF00
            ">
              ${code}
            </div>

            <p style="color:#aaa">
              Este código expira en 10 minutos.
            </p>

            <hr style="border:1px solid #333;margin:20px 0">

            <p style="font-size:12px;color:#777">
              Si no solicitaste este cambio puedes ignorar este mensaje.
            </p>

        </div>
        </div>
      `
    });

    return response;

  } catch (err) {
    console.error("EMAIL ERROR:", err);
    throw err;
  }
}